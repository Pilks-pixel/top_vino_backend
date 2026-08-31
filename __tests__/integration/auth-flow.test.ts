import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

const request = (await import("supertest")).default;
const { app } = await import("../setup/testApp.js");
const { cleanDb, disconnectDb, testPrisma } = await import(
  "../setup/testDb.js"
);
const { UserProfileResponse } = await import(
  "../../src/utils/responseSchema.js"
);

const SIGN_UP_BODY = {
  name: "Auth Flow User",
  email: "auth-flow@test.com",
  password: "auth-flow-password-123",
};

beforeEach(async () => cleanDb());
afterEach(async () => cleanDb());
afterAll(async () => disconnectDb());

describe("real Better Auth cookie flow", () => {
  it("a newly signed-up user can access their Top Vino profile", async () => {
    const agent = request.agent(app);

    const signUpRes = await agent
      .post("/api/auth/sign-up/email")
      .send(SIGN_UP_BODY);

    expect(signUpRes.status).toBe(200);
    expect(signUpRes.headers["set-cookie"]).toBeDefined();
    expect(signUpRes.body.user).toMatchObject({
      name: SIGN_UP_BODY.name,
      email: SIGN_UP_BODY.email,
    });
    expect(signUpRes.body.user.id).toEqual(expect.any(String));

    const [userCount, accountCount, sessionCount] = await Promise.all([
      testPrisma.user.count({ where: { id: signUpRes.body.user.id } }),
      testPrisma.account.count({ where: { userId: signUpRes.body.user.id } }),
      testPrisma.session.count({ where: { userId: signUpRes.body.user.id } }),
    ]);
    expect({ userCount, accountCount, sessionCount }).toEqual({
      userCount: 1,
      accountCount: 1,
      sessionCount: 1,
    });

    const sessionRes = await agent.get("/api/auth/get-session");

    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body.user).toMatchObject({
      id: signUpRes.body.user.id,
      subscriptionType: "FREE",
    });

    const meRes = await agent.get("/user/me");

    expect(meRes.status).toBe(200);
    UserProfileResponse.parse(meRes.body);
    expect(meRes.body.data).toEqual({
      id: signUpRes.body.user.id,
      name: SIGN_UP_BODY.name,
      email: SIGN_UP_BODY.email,
      subscriptionType: "FREE",
    });
  });
});
