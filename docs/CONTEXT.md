# Top Vino

A spaced-repetition learning application. Users build decks of cards, study them on a schedule derived from how well they recall each one, and can share decks with others.

## Language

### Content

**Deck**:
A named collection of cards belonging to exactly one user. The unit of sharing and of access control.
_Avoid_: set, collection, pack

**Card**:
A single prompt and its answer, belonging to exactly one deck. A card has no owner of its own — it takes its owner from its deck.
_Avoid_: flashcard, item, question

**Public Deck**:
A deck its owner has opened to every authenticated user for reading and studying. Public never confers the ability to change a deck or its cards.
_Avoid_: shared deck, open deck

### Access

**Requestor**:
The authenticated user on whose behalf an operation runs. Always derived from the session, never from user-supplied input.
_Avoid_: current user, actor, principal, caller

**Deck Access**:
The rules governing what a requestor may do with a deck. Resolves ownership, collaborator role and public visibility into a single answer. Cards and reviews inherit their access from the deck they belong to.
_Avoid_: permissions, policy, authorization rules, guard

**Action**:
What a requestor intends to do with a deck: read, edit, or delete. Requestors state the action; which roles satisfy it is a matter of deck access, not something a caller decides.
_Avoid_: operation, permission, verb

**Collaborator**:
A user granted access to a deck they do not own, as either an editor or a viewer. An editor may read and edit; a viewer may only read. Neither may delete — that stays with the owner.
_Avoid_: shared user, member, contributor

**Subscription Tier**:
Whether a user is on the free or pro plan. Governs which features they may reach, and is a separate question from deck access — tier never decides who owns what.
_Avoid_: plan, membership, subscription level

### Study

**Review**:
One graded attempt at a card, recorded with the quality of recall the requestor reported.
_Avoid_: attempt, answer, session

**Progress**:
A requestor's scheduling state for a single card — how well they know it and when they should next see it. Progress belongs to the requestor, not to the deck's owner, so studying another user's public deck builds progress of your own.
_Avoid_: card state, schedule, history
