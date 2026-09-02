import * as z from "zod/v4";

import "./middlewares/errorHandler.ts";
import "./utils/cardSchema.ts";
import "./utils/deckSchema.ts";
import "./utils/paramsSchema.ts";
import "./utils/responseSchema.ts";
import "./utils/reviewSchema.ts";
import "./utils/userSchema.ts";

type HttpMethod = "get" | "post" | "put" | "delete";
type SchemaObject = Record<string, unknown>;
type ParameterObject = {
  name: string;
  in: "path" | "query";
  required?: boolean;
  schema: SchemaObject;
};
type ResponseObject = {
  description: string;
  content?: Record<string, { schema: SchemaObject }>;
};
type OperationObject = {
  operationId: string;
  summary: string;
  tags: string[];
  security?: Array<Record<string, never[]>>;
  parameters?: ParameterObject[];
  requestBody?: {
    required: true;
    content: {
      "application/json": { schema: SchemaObject };
    };
  };
  responses: Record<string, ResponseObject>;
};
type PathItemObject = Partial<Record<HttpMethod, OperationObject>>;

type RouteMetadata = {
  method: HttpMethod;
  path: string;
  operationId: string;
  summary: string;
  tag: string;
  successStatus?: number;
  successDescription: string;
  responseSchema: string;
  responseContentType?: "application/json" | "text/html";
  requestSchema?: string;
  parameters?: ParameterObject[];
  errorStatuses?: number[];
  authenticated?: boolean;
};

export type OpenApiDocument = {
  openapi: "3.1.0";
  jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema";
  info: {
    title: string;
    version: string;
    description: string;
  };
  paths: Record<string, PathItemObject>;
  components: {
    schemas: Record<string, unknown>;
    securitySchemes: {
      sessionCookie: {
        type: "apiKey";
        in: "cookie";
        name: "better-auth.session_token";
        description: string;
      };
    };
  };
};

const schemaRef = (id: string): SchemaObject => ({
  $ref: `#/components/schemas/${id}`,
});

const schemaPropertyRef = (id: string, property: string): SchemaObject => ({
  $ref: `#/components/schemas/${id}/properties/${property}`,
});

const pathParameter = (
  name: string,
  schemaId: string,
  property = name,
): ParameterObject => ({
  name,
  in: "path",
  required: true,
  schema: schemaPropertyRef(schemaId, property),
});

const queryParameter = (name: string, schemaId: string): ParameterObject => ({
  name,
  in: "query",
  schema: schemaPropertyRef(schemaId, name),
});

const errorDescriptions: Record<number, string> = {
  400: "Invalid request",
  401: "Authentication required",
  403: "Deck access or ownership does not allow this action",
  404: "Resource not found",
  429: "Rate limit exceeded",
  500: "Internal server error",
};

function response(
  description: string,
  schemaId: string,
  contentType: "application/json" | "text/html" = "application/json",
): ResponseObject {
  return {
    description,
    content: {
      [contentType]: { schema: schemaRef(schemaId) },
    },
  };
}

function errorResponses(statuses: number[]): Record<string, ResponseObject> {
  return Object.fromEntries(
    statuses.map(status => [
      String(status),
      response(errorDescriptions[status] ?? "Request failed", "ErrorResponse"),
    ]),
  );
}

const authenticatedErrors = [401, 429, 500];
const validatedErrors = [400, ...authenticatedErrors];
const resourceErrors = [400, 403, 404, ...authenticatedErrors];

const routes: RouteMetadata[] = [
  {
    method: "get",
    path: "/",
    operationId: "getRoot",
    summary: "Return the API greeting",
    tag: "System",
    successDescription: "API is reachable",
    responseSchema: "RootResponse",
    responseContentType: "text/html",
  },
  {
    method: "get",
    path: "/health",
    operationId: "getHealth",
    summary: "Report process health",
    tag: "System",
    successDescription: "Process is healthy",
    responseSchema: "HealthResponse",
  },
  {
    method: "get",
    path: "/ready",
    operationId: "getReadiness",
    summary: "Report database readiness",
    tag: "System",
    successDescription: "Database is reachable",
    responseSchema: "ReadinessResponse",
    errorStatuses: [503],
  },
  {
    method: "get",
    path: "/openapi.json",
    operationId: "getOpenApiDocument",
    summary: "Return this OpenAPI document",
    tag: "System",
    successDescription: "OpenAPI 3.1 document",
    responseSchema: "OpenApiDocumentResponse",
  },
  {
    method: "get",
    path: "/user/me",
    operationId: "getRequestorProfile",
    summary: "Get the requestor's user profile",
    tag: "Users",
    successDescription: "Requestor profile",
    responseSchema: "UserProfileResponse",
    errorStatuses: [404, ...authenticatedErrors],
    authenticated: true,
  },
  {
    method: "get",
    path: "/user/{id}",
    operationId: "getUserProfile",
    summary: "Get a user profile by ID",
    tag: "Users",
    successDescription: "User profile",
    responseSchema: "UserProfileResponse",
    parameters: [pathParameter("id", "UserIdParams")],
    errorStatuses: [400, 404, ...authenticatedErrors],
    authenticated: true,
  },
  {
    method: "put",
    path: "/user/{id}",
    operationId: "updateUserProfile",
    summary: "Update the requestor's user profile",
    tag: "Users",
    successDescription: "Updated user profile",
    responseSchema: "UserProfileResponse",
    requestSchema: "UserUpdate",
    parameters: [pathParameter("id", "UserIdParams")],
    errorStatuses: resourceErrors,
    authenticated: true,
  },
  {
    method: "delete",
    path: "/user/{id}",
    operationId: "deleteUser",
    summary: "Delete the requestor's user",
    tag: "Users",
    successDescription: "User deleted",
    responseSchema: "UserDeleteResponse",
    parameters: [pathParameter("id", "UserIdParams")],
    errorStatuses: resourceErrors,
    authenticated: true,
  },
  {
    method: "get",
    path: "/deck",
    operationId: "listDecks",
    summary: "List visible decks for a user",
    tag: "Decks",
    successDescription: "Deck list",
    responseSchema: "DeckListResponse",
    parameters: [queryParameter("userId", "ListDecksQuery")],
    errorStatuses: [400, 403, ...authenticatedErrors],
    authenticated: true,
  },
  {
    method: "get",
    path: "/deck/{id}",
    operationId: "getDeck",
    summary: "Get a deck",
    tag: "Decks",
    successDescription: "Deck",
    responseSchema: "DeckResponse",
    parameters: [pathParameter("id", "IdParams")],
    errorStatuses: resourceErrors,
    authenticated: true,
  },
  {
    method: "post",
    path: "/deck",
    operationId: "createDeck",
    summary: "Create a deck",
    tag: "Decks",
    successStatus: 201,
    successDescription: "Deck created",
    responseSchema: "DeckCreateResponse",
    requestSchema: "CreateDeck",
    errorStatuses: validatedErrors,
    authenticated: true,
  },
  {
    method: "put",
    path: "/deck/{id}",
    operationId: "updateDeck",
    summary: "Update a deck",
    tag: "Decks",
    successDescription: "Deck updated",
    responseSchema: "DeckUpdateResponse",
    requestSchema: "UpdateDeck",
    parameters: [pathParameter("id", "IdParams")],
    errorStatuses: resourceErrors,
    authenticated: true,
  },
  {
    method: "delete",
    path: "/deck/{id}",
    operationId: "deleteDeck",
    summary: "Delete a deck",
    tag: "Decks",
    successDescription: "Deck deleted",
    responseSchema: "DeckDeleteResponse",
    parameters: [pathParameter("id", "IdParams")],
    errorStatuses: resourceErrors,
    authenticated: true,
  },
  {
    method: "get",
    path: "/deck/{deckId}/cards",
    operationId: "listCards",
    summary: "List cards in a deck",
    tag: "Cards",
    successDescription: "Card list",
    responseSchema: "CardListResponse",
    parameters: [pathParameter("deckId", "DeckIdParams")],
    errorStatuses: resourceErrors,
    authenticated: true,
  },
  {
    method: "get",
    path: "/deck/{deckId}/cards/{id}",
    operationId: "getCard",
    summary: "Get a card",
    tag: "Cards",
    successDescription: "Card",
    responseSchema: "CardResponse",
    parameters: [
      pathParameter("deckId", "DeckCardParams"),
      pathParameter("id", "DeckCardParams"),
    ],
    errorStatuses: resourceErrors,
    authenticated: true,
  },
  {
    method: "post",
    path: "/deck/{deckId}/cards",
    operationId: "createCard",
    summary: "Create a card in a deck",
    tag: "Cards",
    successStatus: 201,
    successDescription: "Card created",
    responseSchema: "CardCreateResponse",
    requestSchema: "CreateCard",
    parameters: [pathParameter("deckId", "DeckIdParams")],
    errorStatuses: resourceErrors,
    authenticated: true,
  },
  {
    method: "put",
    path: "/deck/{deckId}/cards/{id}",
    operationId: "updateCard",
    summary: "Update a card",
    tag: "Cards",
    successDescription: "Card updated",
    responseSchema: "CardUpdateResponse",
    requestSchema: "UpdateCard",
    parameters: [
      pathParameter("deckId", "DeckCardParams"),
      pathParameter("id", "DeckCardParams"),
    ],
    errorStatuses: resourceErrors,
    authenticated: true,
  },
  {
    method: "delete",
    path: "/deck/{deckId}/cards/{id}",
    operationId: "deleteCard",
    summary: "Delete a card",
    tag: "Cards",
    successDescription: "Card deleted",
    responseSchema: "CardDeleteResponse",
    parameters: [
      pathParameter("deckId", "DeckCardParams"),
      pathParameter("id", "DeckCardParams"),
    ],
    errorStatuses: resourceErrors,
    authenticated: true,
  },
  {
    method: "post",
    path: "/review",
    operationId: "submitReview",
    summary: "Submit a card review",
    tag: "Reviews",
    successStatus: 201,
    successDescription: "Review recorded and progress updated",
    responseSchema: "ReviewSubmitResponse",
    requestSchema: "SubmitReview",
    errorStatuses: [400, 403, 404, ...authenticatedErrors],
    authenticated: true,
  },
  {
    method: "get",
    path: "/review/due",
    operationId: "listDueCards",
    summary: "List cards due for the requestor",
    tag: "Study",
    successDescription: "Due cards",
    responseSchema: "DueCardsResponse",
    errorStatuses: authenticatedErrors,
    authenticated: true,
  },
  {
    method: "get",
    path: "/review/progress/{cardId}",
    operationId: "getCardProgress",
    summary: "Get the requestor's progress for a card",
    tag: "Study",
    successDescription: "Card progress",
    responseSchema: "ProgressResponse",
    parameters: [pathParameter("cardId", "CardIdParams")],
    errorStatuses: [400, 403, 404, ...authenticatedErrors],
    authenticated: true,
  },
];

function buildPaths(): Record<string, PathItemObject> {
  const paths: Record<string, PathItemObject> = {};

  for (const route of routes) {
    const successStatus = String(route.successStatus ?? 200);
    const responses: Record<string, ResponseObject> = {
      [successStatus]: response(
        route.successDescription,
        route.responseSchema,
        route.responseContentType,
      ),
    };

    if (route.path === "/ready") {
      responses["503"] = response(
        "Database is unavailable",
        "ReadinessUnavailableResponse",
      );
    } else if (route.errorStatuses) {
      Object.assign(responses, errorResponses(route.errorStatuses));
    }

    const operation: OperationObject = {
      operationId: route.operationId,
      summary: route.summary,
      tags: [route.tag],
      responses,
    };

    if (route.authenticated) operation.security = [{ sessionCookie: [] }];
    if (route.parameters) operation.parameters = route.parameters;
    if (route.requestSchema) {
      operation.requestBody = {
        required: true,
        content: {
          "application/json": { schema: schemaRef(route.requestSchema) },
        },
      };
    }

    const pathItem = paths[route.path] ?? {};
    pathItem[route.method] = operation;
    paths[route.path] = pathItem;
  }

  return paths;
}

export function generateOpenApiDocument(): OpenApiDocument {
  const { schemas } = z.toJSONSchema(z.globalRegistry, {
    target: "draft-2020-12",
    uri: id => `#/components/schemas/${id}`,
  });

  return {
    openapi: "3.1.0",
    jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
    info: {
      title: "Top Vino API",
      version: "1.0.0",
      description:
        "API for building decks, studying cards, and tracking spaced-repetition progress. Requests sent through the interactive API reference are real and persist in the configured development database.",
    },
    paths: buildPaths(),
    components: {
      schemas,
      securitySchemes: {
        sessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "better-auth.session_token",
          description: "Better Auth session cookie",
        },
      },
    },
  };
}

export const openApiDocument = generateOpenApiDocument();
