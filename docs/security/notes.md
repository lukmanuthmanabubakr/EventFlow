## npm audit findings — order-service (noted Week 1, addressed Week 9)

4 high severity: deepmerge-ts, mysql2 — both are Prisma's MySQL-support
dependencies, unused since this project is Postgres-only. Not a live
risk. Revisit at Week 9 audit: either accept and document, or move off
prisma7.config.ts once a non-breaking fix exists.
