-- Seed the 22 known department codes from PROJECT.md.
-- display_name = code where long-form name is unknown; future migration can refine.
insert into public.departments (code, display_name) values
  ('AMER', 'AMER'),
  ('ASD',  'ASD'),
  ('ASN',  'ASN'),
  ('ASNP', 'ASNP'),
  ('BKS',  'BKS'),
  ('CER',  'CER'),
  ('CLK',  'CLK'),
  ('DEC',  'DEC'),
  ('DRW',  'DRW'),
  ('ENT',  'ENT'),
  ('FRN',  'FRN'),
  ('GEN',  'GEN'),
  ('GLS',  'GLS'),
  ('MAP',  'MAP'),
  ('MDF',  'MDF'),
  ('MUS',  'MUS'),
  ('PER',  'PER'),
  ('PND',  'PND'),
  ('PNT',  'PNT'),
  ('SPT',  'SPT'),
  ('SIL',  'SIL'),
  ('TXTL', 'TXTL')
on conflict (code) do nothing;
