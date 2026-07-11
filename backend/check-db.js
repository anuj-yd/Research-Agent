require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

prisma.investmentReport.findMany({ orderBy: { createdAt: 'desc' }, take: 1 })
  .then(reports => console.log(JSON.stringify(reports, null, 2)))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
