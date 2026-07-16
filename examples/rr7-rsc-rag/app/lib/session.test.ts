import { describe, expect, it } from "vitest";
import { getSessionUser, requireUser, type SessionUser } from "./session";

describe("getSessionUser", () => {
  it("returns null when there is no session", async () => {
    const user = await getSessionUser(new Request("http://localhost/dashboard"), {
      getSession: async () => null,
    });
    expect(user).toBeNull();
  });

  it("returns the user when a session exists", async () => {
    const sessionUser: SessionUser = {
      id: "user_1",
      name: "Ada",
      email: "ada@example.com",
    };
    const user = await getSessionUser(new Request("http://localhost/dashboard"), {
      getSession: async () => ({ user: sessionUser }),
    });
    expect(user).toEqual(sessionUser);
  });
});

describe("requireUser", () => {
  it("returns the user when authenticated", async () => {
    const sessionUser: SessionUser = {
      id: "user_1",
      name: "Ada",
      email: "ada@example.com",
    };
    const user = await requireUser(new Request("http://localhost/dashboard"), {
      getSession: async () => ({ user: sessionUser }),
    });
    expect(user).toEqual(sessionUser);
  });

  it("throws a redirect Response to /login when unauthenticated", async () => {
    await expect(
      requireUser(new Request("http://localhost/dashboard"), {
        getSession: async () => null,
      }),
    ).rejects.toMatchObject({
      status: 302,
      headers: expect.any(Headers),
    });

    try {
      await requireUser(new Request("http://localhost/dashboard"), {
        getSession: async () => null,
      });
      expect.unreachable("should have thrown");
    } catch (error) {
      const response = error as Response;
      expect(response.headers.get("Location")).toBe(
        "/login?next=%2Fdashboard",
      );
    }
  });
});

describe("login redirect target", () => {
  it("preserves next path on requireUser redirect", async () => {
    try {
      await requireUser(
        new Request("http://localhost/dashboard?tab=docs"),
        {
          getSession: async () => null,
        },
        { loginPath: "/login" },
      );
      expect.unreachable("should have thrown");
    } catch (error) {
      const response = error as Response;
      const location = response.headers.get("Location") ?? "";
      expect(location.startsWith("/login")).toBe(true);
      expect(location).toContain("next=");
    }
  });
});
