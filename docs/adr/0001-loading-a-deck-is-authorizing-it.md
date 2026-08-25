# Loading a deck is authorizing it

Deck access had drifted into three places — router middleware for users, service bodies for decks, nothing at all for cards and reviews — which left every card operation and `GET /deck/:id` reachable by any authenticated requestor. Rather than add the missing checks, we removed the possibility of a missing check: there is no way to fetch a deck or card without naming a requestor and an action, so an unguarded read cannot be written. The rules live in one module, Deck Access.

## Considered options

**Router middleware everywhere.** Declarative and visible in the router, but it needs a second read to see the resource, only guards the HTTP door, and a new route that omits the middleware still compiles. Rejected: forgetting stays possible, which is how we got here.

**Ownership checks inside each feature module.** This is what deck already did. Rejected for the same reason — `getDeck` and all five card operations were written against the same pattern and simply didn't include the check.

**Subscription tier behind the same seam.** Rejected: tier is resource-independent, and a quota such as "free users get three decks" has to fire at creation time when there is no deck to load. `requireSubscription` stays route middleware.

## Consequences

There is deliberately no `getDeckByID(id)` or `getCardByID(id)`. Reintroducing one as a convenience — for a background job, an admin screen, a seed script — silently reopens the hole this decision closed. If an unauthenticated path is genuinely needed, it should be a named exception on the Deck Access interface, not a bare fetch.

Collections are covered by the same rule through a visibility scope composed into the query, so unauthorized rows are never selected rather than filtered out afterwards. This couples Deck Access to the persistence layer's query shape, which we accepted in exchange for correct pagination and counts.

A requestor who lacks privilege on a deck that exists receives 403, not 404. Ids are UUIDv4 and cannot be enumerated, so confirming existence gains an attacker nothing, and honest errors are worth considerably more when diagnosing permission bugs.
