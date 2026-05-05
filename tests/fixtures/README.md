# Reference-bike fixtures

Each entry in `reference-bikes.json` has two expected blocks:

- `spec_sheet` — values from the manufacturer's published geometry sheet.
  Active immediately. Used for Phase-1 sanity (catches gross formula errors).
- `motospec` — values produced by MotoSpec for the same inputs.
  Populated in PRD Phase 2 once a MotoSpec licence is in hand.

## Phase 2 procedure

1. Enter each bike's `inputs` block into MotoSpec exactly as listed.
2. Read MotoSpec's static outputs.
3. Replace `"motospec": null` with `{ "Trail_Static": <value>, ... }` for every
   output we compute.
4. Run `npm test`. The `motospec parity` tests now activate.
5. If any test fails, the discrepancy is a real bug — either in our formula
   or in the inputs we entered. Resolve before adjusting tolerances.

## Adding a new bike

Use a single self-consistent geometry source per bike. Manufacturers sometimes
publish Trail derived from a different Rf or Offset than they publish in the
main geometry sheet — pick one source and stay with it. Document the source in
the `source` field.

The current three reference bikes have `O` derived from the published
`Rake / Rf / Trail` triple (because the manufacturer-published `O` was not
self-consistent with their published Trail at the published Rake/Rf). That
choice is recorded in each entry's `note` field.
