import { POST as rewriteHandler } from "./route";

// Helper to create mock Next.js Request
function createRequest(body: unknown, headers: Record<string, string> = {}) {
  const reqHeaders = new Headers(headers);
  if (typeof body === "string") {
    return new Request("http://localhost:3000/api/rewrite", {
      method: "POST",
      headers: reqHeaders,
      body: body,
    });
  }
  
  if (body !== undefined && body !== null) {
    if (!reqHeaders.has("Content-Type")) {
      reqHeaders.set("Content-Type", "application/json");
    }
    return new Request("http://localhost:3000/api/rewrite", {
      method: "POST",
      headers: reqHeaders,
      body: JSON.stringify(body),
    });
  }

  return new Request("http://localhost:3000/api/rewrite", {
    method: "POST",
    headers: reqHeaders,
  });
}

describe("POST /api/rewrite", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    // Clear ambient keys by default to test explicit header / env handling
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    global.fetch = jest.fn() as jest.Mock;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe("API Key Handling", () => {
    test("uses x-gemini-api-key header when provided", async () => {
      const mockGeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    riskScore: 10,
                    flaggedPhrases: [],
                    suggestedRewrite: "Clean post body",
                  }),
                },
              ],
            },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockGeminiResponse,
      });

      const req = createRequest(
        { body: "Hello world draft" },
        { "x-gemini-api-key": "header-test-key" }
      );

      const res = await rewriteHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({
        source: "gemini",
        riskScore: 10,
        flaggedPhrases: [],
        suggestedRewrite: "Clean post body",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("key=header-test-key"),
        expect.objectContaining({ method: "POST" })
      );
    });

    test("falls back to process.env.GEMINI_API_KEY when header is missing", async () => {
      process.env.GEMINI_API_KEY = "env-gemini-key";

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ riskScore: 5 }) }] } }],
        }),
      });

      const req = createRequest({ body: "Test post" });
      const res = await rewriteHandler(req);

      expect(res.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("key=env-gemini-key"),
        expect.anything()
      );
    });

    test("falls back to process.env.OPENAI_API_KEY when GEMINI_API_KEY and header are missing", async () => {
      process.env.OPENAI_API_KEY = "env-openai-key";

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ riskScore: 5 }) }] } }],
        }),
      });

      const req = createRequest({ body: "Test post" });
      const res = await rewriteHandler(req);

      expect(res.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("key=env-openai-key"),
        expect.anything()
      );
    });

    test("returns 400 error when no API key is provided", async () => {
      const req = createRequest({ body: "Test post without API key" });
      const res = await rewriteHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toMatch(/Gemini API key is required/i);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("Request Validation and Error Handling (400, 404 upstream, 500/502)", () => {
    test("returns 400 when request body is invalid JSON", async () => {
      const req = createRequest("invalid-json{", { "Content-Type": "application/json" });
      const res = await rewriteHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Invalid JSON request body.");
    });

    test("returns 400 when body field is missing or empty", async () => {
      const req = createRequest({ body: "   " }, { "x-gemini-api-key": "test-key" });
      const res = await rewriteHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("A post body is required.");
    });

    test("handles upstream 404 error from Gemini API gracefully (returns 400 with status mapping)", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: { message: "Resource / model not found." },
        }),
      });

      const req = createRequest({ body: "Test post" }, { "x-gemini-api-key": "valid-key" });
      const res = await rewriteHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("Gemini API Error (404): Resource / model not found.");
    });

    test("handles upstream 500 error from Gemini API (mapped to 502)", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal server error in upstream service",
      });

      const req = createRequest({ body: "Test post" }, { "x-gemini-api-key": "valid-key" });
      const res = await rewriteHandler(req);
      const data = await res.json();

      expect(res.status).toBe(502);
      expect(data.error).toContain("Gemini API Error (500)");
    });

    test("returns 500 on unexpected exception during execution", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network disconnect failure"));

      const req = createRequest({ body: "Test post" }, { "x-gemini-api-key": "valid-key" });
      const res = await rewriteHandler(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Network disconnect failure");
    });
  });

  describe("Risk Score Parsing & Response Normalization", () => {
    test("correctly parses valid JSON response from Gemini", async () => {
      const mockPayload = {
        riskScore: 78,
        flaggedPhrases: ["risky phrase"],
        suggestedRewrite: "Safe and softened rewrite text",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(mockPayload) }] } }],
        }),
      });

      const req = createRequest({ body: "Original risky post" }, { "x-gemini-api-key": "key" });
      const res = await rewriteHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({
        source: "gemini",
        riskScore: 78,
        flaggedPhrases: ["risky phrase"],
        suggestedRewrite: "Safe and softened rewrite text",
      });
    });

    test("parses markdown codeblock formatted JSON (` ```json ... ``` `)", async () => {
      const jsonContent = JSON.stringify({
        riskScore: 42,
        flaggedPhrases: ["questionable text"],
        suggestedRewrite: "Cleaned version",
      });
      const markdownWrapped = `\`\`\`json\n${jsonContent}\n\`\`\``;

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: markdownWrapped }] } }],
        }),
      });

      const req = createRequest({ body: "Draft text" }, { "x-gemini-api-key": "key" });
      const res = await rewriteHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.riskScore).toBe(42);
      expect(data.flaggedPhrases).toEqual(["questionable text"]);
      expect(data.suggestedRewrite).toBe("Cleaned version");
    });

    test("falls back to default riskScore (15) and body when Gemini response text is non-JSON text", async () => {
      const plainTextResponse = "This draft is fine as is, no changes needed.";

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: plainTextResponse }] } }],
        }),
      });

      const req = createRequest({ body: "Original body text" }, { "x-gemini-api-key": "key" });
      const res = await rewriteHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.riskScore).toBe(15);
      expect(data.flaggedPhrases).toEqual([]);
      expect(data.suggestedRewrite).toBe(plainTextResponse);
    });

    test("falls back to default riskScore (15) when riskScore field is missing in JSON", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ suggestedRewrite: "New text without riskScore" }) }],
              },
            },
          ],
        }),
      });

      const req = createRequest({ body: "Original body" }, { "x-gemini-api-key": "key" });
      const res = await rewriteHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.riskScore).toBe(15);
      expect(data.suggestedRewrite).toBe("New text without riskScore");
    });
  });
});
