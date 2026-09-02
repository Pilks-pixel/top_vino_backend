import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

const request = (await import("supertest")).default;
const { app } = await import("../setup/testApp.js");
const { cleanDb, disconnectDb, testPrisma } = await import(
  "../setup/testDb.js"
);
const {
  CardCreateResponse,
  DeckCreateResponse,
  DeckListResponse,
  DeckUpdateResponse,
  ProgressResponse,
  ReviewSubmitResponse,
  UserDeleteResponse,
  UserProfileResponse,
} = await import("../../src/utils/responseSchema.js");

const SIGN_UP_BODY = {
  name: "Auth Flow User",
  email: "auth-flow@test.com",
  password: "auth-flow-password-123",
};

const OTHER_SIGN_UP_BODY = {
  name: "Other Auth Flow User",
  email: "other-auth-flow@test.com",
  password: "other-auth-flow-password-123",
};

beforeEach(async () => cleanDb());
afterEach(async () => cleanDb());
afterAll(async () => disconnectDb());

describe("real Better Auth cookie flow", () => {
  it("keeps opaque identities valid through user, deck, and study contracts", async () => {
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

    const profileRes = await agent.get(`/user/${signUpRes.body.user.id}`);

    expect(profileRes.status).toBe(200);
    UserProfileResponse.parse(profileRes.body);
    expect(profileRes.body.data).toEqual(meRes.body.data);

    const updateRes = await agent
      .put(`/user/${signUpRes.body.user.id}`)
      .send({ name: "Updated Auth Flow User" });

    expect(updateRes.status).toBe(200);
    UserProfileResponse.parse(updateRes.body);
    expect(updateRes.body.data.name).toBe("Updated Auth Flow User");

    const createDeckRes = await agent.post("/deck").send({
      name: "Opaque ID Deck",
      topic: "Identity contracts",
      isPublic: false,
    });

    expect(createDeckRes.status).toBe(201);
    DeckCreateResponse.parse(createDeckRes.body);
    expect(createDeckRes.body.data.userId).toBe(signUpRes.body.user.id);

    const listDecksRes = await agent.get(
      `/deck?userId=${encodeURIComponent(signUpRes.body.user.id)}`,
    );

    expect(listDecksRes.status).toBe(200);
    DeckListResponse.parse(listDecksRes.body);
    expect(listDecksRes.body.data).toEqual([createDeckRes.body.data]);

    const createCardRes = await agent
      .post(`/deck/${createDeckRes.body.data.id}/cards`)
      .send({
        type: "basic",
        question: "Which identifier owns this review?",
        correctAnswer: "The opaque Better Auth user identifier",
      });

    expect(createCardRes.status).toBe(201);
    CardCreateResponse.parse(createCardRes.body);

    const otherAgent = request.agent(app);
    const otherSignUpRes = await otherAgent
      .post("/api/auth/sign-up/email")
      .send(OTHER_SIGN_UP_BODY);

    expect(otherSignUpRes.status).toBe(200);

    const privateDecksRes = await otherAgent.get(
      `/deck?userId=${encodeURIComponent(signUpRes.body.user.id)}`,
    );

    expect(privateDecksRes.status).toBe(200);
    DeckListResponse.parse(privateDecksRes.body);
    expect(privateDecksRes.body.data).toEqual([]);

    const publishDeckRes = await agent
      .put(`/deck/${createDeckRes.body.data.id}`)
      .send({ isPublic: true });

    expect(publishDeckRes.status).toBe(200);
    DeckUpdateResponse.parse(publishDeckRes.body);

    const publicDecksRes = await otherAgent.get(
      `/deck?userId=${encodeURIComponent(signUpRes.body.user.id)}`,
    );

    expect(publicDecksRes.status).toBe(200);
    DeckListResponse.parse(publicDecksRes.body);
    expect(publicDecksRes.body.data).toEqual([publishDeckRes.body.data]);

    const reviewRes = await otherAgent.post("/review").send({
      cardId: createCardRes.body.data.id,
      quality: 4,
    });

    expect(reviewRes.status).toBe(201);
    ReviewSubmitResponse.parse(reviewRes.body);
    expect(reviewRes.body.data.review.userId).toBe(otherSignUpRes.body.user.id);
    expect(reviewRes.body.data.progress.userId).toBe(
      otherSignUpRes.body.user.id,
    );

    const progressRes = await otherAgent.get(
      `/review/progress/${createCardRes.body.data.id}`,
    );

    expect(progressRes.status).toBe(200);
    ProgressResponse.parse(progressRes.body);
    expect(progressRes.body.data).toEqual(reviewRes.body.data.progress);
  });

  it("deletes a newly signed-up user by their Better Auth identifier", async () => {
    const agent = request.agent(app);
    const signUpRes = await agent
      .post("/api/auth/sign-up/email")
      .send(SIGN_UP_BODY);

    expect(signUpRes.status).toBe(200);

    const deleteRes = await agent.delete(`/user/${signUpRes.body.user.id}`);

    expect(deleteRes.status).toBe(200);
    UserDeleteResponse.parse(deleteRes.body);
    expect(deleteRes.body.message).toBe("User deleted successfully");

    const replacementAgent = request.agent(app);
    const replacementSignUpRes = await replacementAgent
      .post("/api/auth/sign-up/email")
      .send(SIGN_UP_BODY);

    expect(replacementSignUpRes.status).toBe(200);
  });
});
