// Deterministic fixtures for VerifiedFactsV2 (Workstream F corpus).
// Each fixture is a BirthInput plus expected invariants. No customer PII; these are
// public/synthetic birth data used only to exercise the compute layer.

export interface FactsFixture {
  name: string;
  birth: { date: string; time?: string; location: string; unknownTime?: boolean; name?: string };
  expect: {
    knownTime: boolean;
    boundaryCheck?: 'near0' | 'near29';
    expectRetrograde?: boolean;
    expectNullDignity?: boolean;
  };
}

export const KNOWN_TIME_ORDINARY: FactsFixture = {
  name: 'known-ordinary',
  birth: { date: '1990-06-15', time: '12:00', location: 'Paris', name: 'Fixture A' },
  expect: { knownTime: true },
};

export const UNKNOWN_TIME_SOLAR: FactsFixture = {
  name: 'unknown-time-solar',
  birth: { date: '1985-03-22', location: 'Berlin', unknownTime: true, name: 'Fixture B' },
  expect: { knownTime: false },
};

export const BOUNDARY_NEAR_0: FactsFixture = {
  name: 'boundary-near-0',
  birth: { date: '2000-03-21', time: '00:01', location: 'London', name: 'Fixture C' },
  expect: { knownTime: true, boundaryCheck: 'near0' },
};

export const BOUNDARY_NEAR_29: FactsFixture = {
  name: 'boundary-near-29',
  birth: { date: '2000-04-19', time: '23:50', location: 'London', name: 'Fixture D' },
  expect: { knownTime: true, boundaryCheck: 'near29' },
};

export const RETRO_NULL_DIGNITY: FactsFixture = {
  name: 'retro-null-dignity',
  birth: { date: '1979-10-05', time: '09:30', location: 'Tokyo', name: 'Fixture E' },
  expect: { knownTime: true, expectNullDignity: true },
};

export const DENSE_ASPECT: FactsFixture = {
  name: 'dense-aspect',
  birth: { date: '1995-01-12', time: '06:15', location: 'New York', name: 'Fixture F' },
  expect: { knownTime: true },
};

export const SPARSE_ASPECT: FactsFixture = {
  name: 'sparse-aspect',
  birth: { date: '1988-07-04', time: '03:40', location: 'Sydney', name: 'Fixture G' },
  expect: { knownTime: true },
};

export const ALL_FIXTURES: FactsFixture[] = [
  KNOWN_TIME_ORDINARY,
  UNKNOWN_TIME_SOLAR,
  BOUNDARY_NEAR_0,
  BOUNDARY_NEAR_29,
  RETRO_NULL_DIGNITY,
  DENSE_ASPECT,
  SPARSE_ASPECT,
];
