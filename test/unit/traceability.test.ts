import { describe, expect, it } from 'vitest';
import {
  extractMatrixIds,
  extractSourceIds,
  validateTraceability,
} from '../../scripts/check-traceability.mjs';

describe('requirement traceability', () => {
  it('collects unique requirement and decision IDs from their declarations', () => {
    const srs = `
**UI-001 (P0):** A requirement.
The prose references UI-001 again, and UI-999 is not a declaration.
| ID | Priority | Requirement |
|---|---|---|
| AUTH-001 | P0 | Another requirement |
`;
    const decisions = `
| ID | Decision |
|---|---|
| DEC-001 | A decision |
### DEC-002 — Another decision
`;

    expect([...extractSourceIds(srs, decisions)].sort()).toEqual([
      'AUTH-001',
      'DEC-001',
      'DEC-002',
      'UI-001',
    ]);
  });

  it('reads only matrix tables and rejects missing, duplicate, and extra IDs', () => {
    const matrix = `
| ID | Design owner | Status |
|---|---|---|
| UI-001 | Owner | Planned |
| UI-001 | Duplicate | Planned |
| OLD-001 | Stale | Planned |

| Other | Value |
|---|---|
| UI-777 | Not a traceability row |
`;
    const rows = extractMatrixIds(matrix);
    expect(rows).toEqual(['UI-001', 'UI-001', 'OLD-001']);
    expect(validateTraceability(new Set(['UI-001', 'AUTH-001']), rows)).toEqual({
      missing: ['AUTH-001'],
      duplicates: ['UI-001'],
      extra: ['OLD-001'],
    });
  });

  it('does not accept malformed IDs or IDs embedded in longer tokens', () => {
    const srs = `
**UI-001 (P0):** Valid.
**xUI-002 (P0):** Invalid prefix.
**UI-1234 (P0):** Invalid width.
`;
    expect([...extractSourceIds(srs, '')]).toEqual(['UI-001']);
  });
});
