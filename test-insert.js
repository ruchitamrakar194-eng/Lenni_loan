const prisma = require('./config/db.js');
async function test() {
  try {
    await prisma.auditlog.create({
      data: {
        action: 'TEST',
        user: 'test',
        note: 'A'.repeat(200),
        entityId: 'test'
      }
    });
    console.log('Auditlog success');
  } catch(e) {
    console.error('Auditlog error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
test();
