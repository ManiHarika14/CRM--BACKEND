const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get check constraint definitions for crm1_customers
  const checks = await prisma.$queryRawUnsafe(`
    SELECT cc.constraint_name, cc.check_clause
    FROM information_schema.check_constraints cc
    JOIN information_schema.table_constraints tc
      ON cc.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'crm1_customers'
  `);
  console.log('=== crm1_customers check constraints ===');
  checks.forEach(c => console.log(`  ${c.constraint_name}: ${c.check_clause}`));

  // crm1_customers column nullability
  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'crm1_customers'
    ORDER BY ordinal_position
  `);
  console.log('\n=== crm1_customers column nullability ===');
  cols.forEach(c => console.log(`  ${c.column_name}: nullable=${c.is_nullable} default=${c.column_default}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
