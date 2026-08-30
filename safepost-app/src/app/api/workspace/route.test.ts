import { GET, POST, PUT, PATCH } from "./route";

// Mock MongoDB lib module
jest.mock("../../../lib/mongodb", () => ({
  getMongoDb: jest.fn(),
}));

import { getMongoDb } from "../../../lib/mongodb";

function createRequest(method: string, url: string, body?: unknown) {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new Request(url, init);
}

describe("Draft Review State / Workspace API (/api/workspace)", () => {
  let mockDb: {
    collection: jest.Mock;
  };

  let mockProfilesCollection: {
    findOne: jest.Mock;
    updateOne: jest.Mock;
  };

  let mockPostsCollection: {
    find: jest.Mock;
    insertOne: jest.Mock;
    updateOne: jest.Mock;
  };

  beforeEach(() => {
    jest.resetAllMocks();

    mockProfilesCollection = {
      findOne: jest.fn(),
      updateOne: jest.fn(),
    };

    mockPostsCollection = {
      find: jest.fn(),
      insertOne: jest.fn(),
      updateOne: jest.fn(),
    };

    mockDb = {
      collection: jest.fn((name: string) => {
        if (name === "profiles") return mockProfilesCollection;
        if (name === "posts") return mockPostsCollection;
        throw new Error(`Unknown collection ${name}`);
      }),
    };

    (getMongoDb as jest.Mock).mockResolvedValue(mockDb);
  });

  describe("GET /api/workspace", () => {
    test("returns 400 when workspaceId query parameter is missing", async () => {
      const req = createRequest("GET", "http://localhost:3000/api/workspace");
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("A workspace is required.");
    });

    test("fetches profile and posts for valid workspaceId", async () => {
      const mockProfile = { name: "Test User", role: "Creator", region: "India" };
      const mockPosts = [
        { id: "1", title: "Draft 1", body: "Hello", status: "Needs review", score: 20 },
      ];

      mockProfilesCollection.findOne.mockResolvedValueOnce(mockProfile);
      
      const mockProject = jest.fn().mockReturnValueOnce({
        toArray: jest.fn().mockResolvedValueOnce(mockPosts),
      });
      const mockSort = jest.fn().mockReturnValueOnce({
        project: mockProject,
      });
      mockPostsCollection.find.mockReturnValueOnce({
        sort: mockSort,
      });

      const req = createRequest("GET", "http://localhost:3000/api/workspace?workspaceId=ws-123");
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({
        profile: mockProfile,
        posts: mockPosts,
      });
      expect(mockProfilesCollection.findOne).toHaveBeenCalledWith(
        { workspaceId: "ws-123" },
        { projection: { _id: 0, workspaceId: 0 } }
      );
    });

    test("returns 503 when MongoDB is unavailable", async () => {
      (getMongoDb as jest.Mock).mockRejectedValueOnce(new Error("Connection failed"));

      const req = createRequest("GET", "http://localhost:3000/api/workspace?workspaceId=ws-123");
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(503);
      expect(data.error).toBe("MongoDB is unavailable.");
    });
  });

  describe("PUT /api/workspace (Profile updates)", () => {
    test("returns 400 if workspaceId or profile is missing", async () => {
      const req = createRequest("PUT", "http://localhost:3000/api/workspace", {
        workspaceId: "",
      });
      const res = await PUT(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Workspace and profile are required.");
    });

    test("upserts profile successfully", async () => {
      mockProfilesCollection.updateOne.mockResolvedValueOnce({ acknowledged: true });

      const profileData = {
        name: "Jane Doe",
        email: "jane@example.com",
        role: "Editor",
        region: "United States",
        apiKey: "key-123",
      };

      const req = createRequest("PUT", "http://localhost:3000/api/workspace", {
        workspaceId: "ws-456",
        profile: profileData,
      });

      const res = await PUT(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({ ok: true });
      expect(mockProfilesCollection.updateOne).toHaveBeenCalledWith(
        { workspaceId: "ws-456" },
        {
          $set: expect.objectContaining({
            ...profileData,
            workspaceId: "ws-456",
            userEmail: "jane@example.com",
          }),
        },
        { upsert: true }
      );
    });
  });

  describe("POST /api/workspace (Creating posts)", () => {
    test("returns 400 if post body is missing or whitespace", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/workspace", {
        workspaceId: "ws-123",
        post: { title: "Title", body: "   ", platform: "X", status: "Needs review" },
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Workspace and post body are required.");
    });

    test("creates new post and returns 201 with generated ID", async () => {
      mockPostsCollection.insertOne.mockResolvedValueOnce({
        insertedId: "507f1f77bcf86cd799439011",
      });

      const postInput = {
        title: "New Draft Post",
        body: "Check out this feature!",
        platform: "LinkedIn",
        status: "Needs review",
      };

      const req = createRequest("POST", "http://localhost:3000/api/workspace", {
        workspaceId: "user:user@example.com",
        post: postInput,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.post).toEqual({
        ...postInput,
        id: "507f1f77bcf86cd799439011",
      });
      expect(mockPostsCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          ...postInput,
          workspaceId: "user:user@example.com",
          userEmail: "user@example.com",
        })
      );
    });
  });

  describe("PATCH /api/workspace (Updating draft review state & risk score)", () => {
    test("returns 400 when postId or workspaceId is missing", async () => {
      const req = createRequest("PATCH", "http://localhost:3000/api/workspace", {
        workspaceId: "ws-123",
      });
      const res = await PATCH(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("A valid post is required.");
    });

    test("updates draft body, status, and score when provided", async () => {
      mockPostsCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 });

      const req = createRequest("PATCH", "http://localhost:3000/api/workspace", {
        workspaceId: "ws-123",
        postId: "507f1f77bcf86cd799439011",
        post: { body: "Updated safe body text", status: "Ready to publish" },
        score: 10,
      });

      const res = await PATCH(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({ ok: true });
      expect(mockPostsCollection.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: "ws-123" }),
        {
          $set: expect.objectContaining({
            body: "Updated safe body text",
            status: "Ready to publish",
            score: 10,
          }),
        }
      );
    });

    test("automatically updates status to 'Ready to publish' when score is provided without post object", async () => {
      mockPostsCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 });

      const req = createRequest("PATCH", "http://localhost:3000/api/workspace", {
        workspaceId: "ws-123",
        postId: "custom-id-12",
        score: 15,
      });

      const res = await PATCH(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({ ok: true });
      expect(mockPostsCollection.updateOne).toHaveBeenCalledWith(
        { id: "custom-id-12", workspaceId: "ws-123" },
        {
          $set: expect.objectContaining({
            score: 15,
            status: "Ready to publish",
          }),
        }
      );
    });
  });
});
