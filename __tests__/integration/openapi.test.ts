import * as dotenv from "dotenv";
import { Validator } from "@seriousme/openapi-schema-validator";
dotenv.config({ path: ".env.test" });

const request = (await import("supertest")).default;
const { app } = await import("../setup/testApp.js");
const { default: userRouter } = await import(
  "../../src/routes/user/user.router.js"
);
const { default: deckRouter } = await import(
  "../../src/routes/deck/deck.router.js"
);
const { default: cardRouter } = await import(
  "../../src/routes/card/card.router.js"
);
const { default: reviewRouter } = await import(
  "../../src/routes/review/review.router.js"
);
const { OpenApiDocumentResponse } = await import(
  "../../src/utils/responseSchema.js"
);

type RouteLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
  };
};

type RouterWithStack = {
  stack: RouteLayer[];
};

type AppWithRouter = {
  router: RouterWithStack;
};

const mountedRouters = [
  { basePath: "/user", router: userRouter },
  { basePath: "/deck", router: deckRouter },
  { basePath: "/deck/:deckId/cards", router: cardRouter },
  { basePath: "/review", router: reviewRouter },
] as const;

const operationMethods = ["get", "post", "put", "patch", "delete"] as const;

function toOpenApiPath(path: string): string {
  return path.replace(/:([^/]+)/g, "{$1}");
}

function mountedRouteKeys(): string[] {
  const directRouteKeys = (
    app as unknown as AppWithRouter
  ).router.stack.flatMap(layer => {
    if (!layer.route || layer.route.path.startsWith("/api/auth")) return [];

    return Object.keys(layer.route.methods)
      .filter(method =>
        operationMethods.includes(
          method.toLowerCase() as (typeof operationMethods)[number],
        ),
      )
      .map(
        method => `${method.toLowerCase()} ${toOpenApiPath(layer.route!.path)}`,
      );
  });
  const routerRouteKeys = mountedRouters.flatMap(({ basePath, router }) =>
    (router as unknown as RouterWithStack).stack.flatMap(layer => {
      if (!layer.route) return [];

      const path = `${basePath}${layer.route.path === "/" ? "" : layer.route.path}`;
      return Object.keys(layer.route.methods).map(
        method => `${method.toLowerCase()} ${toOpenApiPath(path)}`,
      );
    }),
  );

  return [...directRouteKeys, ...routerRouteKeys];
}

describe("OpenAPI document", () => {
  it("is valid OpenAPI 3.1", async () => {
    const response = await request(app).get("/openapi.json");
    const validator = new Validator();
    const result = await validator.validate(response.body);

    expect(result).toEqual({ valid: true });
    expect(validator.version).toBe("3.1");
  });

  it("serves an OpenAPI 3.1 document as JSON", async () => {
    const response = await request(app).get("/openapi.json");

    expect(response.status).toBe(200);
    expect(response.type).toBe("application/json");
    OpenApiDocumentResponse.parse(response.body);
    expect(response.body).toMatchObject({
      openapi: "3.1.0",
      info: {
        title: "Top Vino API",
        version: "1.0.0",
      },
    });
  });

  it("publishes every public request, parameter, response, and error schema", async () => {
    const response = await request(app).get("/openapi.json");

    expect(Object.keys(response.body.components.schemas)).toEqual(
      expect.arrayContaining([
        "CreateCard",
        "UpdateCard",
        "CreateDeck",
        "UpdateDeck",
        "ListDecksQuery",
        "SubmitReview",
        "UserUpdate",
        "IdParams",
        "DeckIdParams",
        "CardIdParams",
        "DeckCardParams",
        "Deck",
        "Card",
        "Review",
        "Progress",
        "ReviewSubmit",
        "DeckListResponse",
        "DeckResponse",
        "DeckCreateResponse",
        "DeckUpdateResponse",
        "DeckDeleteResponse",
        "CardListResponse",
        "CardResponse",
        "CardCreateResponse",
        "CardUpdateResponse",
        "CardDeleteResponse",
        "ReviewSubmitResponse",
        "DueCardsResponse",
        "ProgressResponse",
        "UserProfile",
        "UserProfileResponse",
        "UserDeleteResponse",
        "SuccessMessageResponse",
        "ErrorResponse",
        "RootResponse",
        "HealthResponse",
        "ReadinessResponse",
        "ReadinessUnavailableResponse",
        "OpenApiDocumentResponse",
      ]),
    );
  });

  it("does not publish persistence-only schemas", async () => {
    const response = await request(app).get("/openapi.json");

    expect(response.body.components.schemas).not.toHaveProperty("ReviewCreate");
    expect(response.body.components.schemas).not.toHaveProperty(
      "ProgressUpsert",
    );
  });

  it("documents every mounted route with its parameters, body, and responses", async () => {
    const response = await request(app).get("/openapi.json");
    const paths = response.body.paths as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    const documentedRouteKeys = Object.entries(paths).flatMap(
      ([path, pathItem]) =>
        operationMethods.flatMap(method =>
          pathItem[method] ? [`${method} ${path}`] : [],
        ),
    );

    expect(documentedRouteKeys.sort()).toEqual(mountedRouteKeys().sort());

    for (const routeKey of mountedRouteKeys()) {
      const [method, path] = routeKey.split(" ") as [string, string];
      const operation = paths[path][method];
      expect(operation.responses).toBeDefined();

      if (/^\/(user|deck|review)/.test(path)) {
        expect(operation.security).toEqual([{ sessionCookie: [] }]);
      }

      const pathParameterNames = [...path.matchAll(/{([^}]+)}/g)].map(
        match => match[1],
      );
      for (const name of pathParameterNames) {
        expect(operation.parameters).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name, in: "path", required: true }),
          ]),
        );
      }
    }

    for (const routeKey of [
      "post /deck",
      "put /deck/{id}",
      "post /deck/{deckId}/cards",
      "put /deck/{deckId}/cards/{id}",
      "post /review",
      "put /user/{id}",
    ]) {
      const [method, path] = routeKey.split(" ") as [string, string];
      expect(paths[path][method].requestBody).toBeDefined();
    }

    expect(paths["/deck"].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "userId", in: "query" }),
      ]),
    );
  });

  describe("Better Auth generated contract", () => {
    it("serves Better Auth's valid generated OpenAPI document", async () => {
      const response = await request(app).get(
        "/api/auth/open-api/generate-schema",
      );

      expect(response.status).toBe(200);
      expect(response.type).toBe("application/json");
      expect(response.body.openapi).toBe("3.1.1");

      const validator = new Validator();
      const result = await validator.validate(response.body);
      expect(result).toEqual({ valid: true });
    });

    it("documents Top Vino's enabled authentication flows", async () => {
      const response = await request(app).get(
        "/api/auth/open-api/generate-schema",
      );
      const paths = response.body.paths;

      expect(paths["/sign-up/email"].post).toBeDefined();
      expect(paths["/sign-in/email"].post).toBeDefined();
      expect(paths["/get-session"].get).toBeDefined();
      expect(paths["/sign-out"].post).toBeDefined();
      expect(paths["/sign-in/social"].post).toBeDefined();
    });

    it("documents google as an allowed social sign-in provider", async () => {
      const response = await request(app).get(
        "/api/auth/open-api/generate-schema",
      );
      const provider =
        response.body.paths["/sign-in/social"].post.requestBody.content[
          "application/json"
        ].schema.properties.provider;

      expect(provider.anyOf).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ enum: expect.arrayContaining(["google"]) }),
        ]),
      );
    });

    it("does not mount Better Auth's default reference", async () => {
      const response = await request(app).get("/api/auth/reference");

      expect(response.status).toBe(404);
    });
  });

  it("keeps the Top Vino contract independent of Better Auth", async () => {
    const response = await request(app).get("/openapi.json");

    const authPaths = Object.keys(response.body.paths).filter(path =>
      path.startsWith("/api/auth/"),
    );

    expect(authPaths).toEqual([]);
  });

  it("warns that interactive requests persist", async () => {
    const response = await request(app).get("/openapi.json");

    expect(response.body.info.description).toMatch(/real/i);
    expect(response.body.info.description).toMatch(/persist/i);
  });
});
