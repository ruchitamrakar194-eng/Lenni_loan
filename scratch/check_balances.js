const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { calculateEarlySettlement } = require('../utils/settlementCalculator');

(async () => {
  console.log("=== VERIFYING PIPELINE VS ACTUAL BALANCE CALCULATIONS ===");
  try {
    const loans = await prisma.loan.findMany({
      where: {
        status: { in: ['Active', 'ACTIVE', 'Disbursed', 'DISBURSED'] }
      },
      include: {
        installment: true,
        interest_allocations: true,
        service_fee_allocations: true
      }
    });

    if (loans.length === 0) {
      console.log("No active/disbursed loans found.");
      return;
    }

    const now = new Date();
    for (const loan of loans) {
      const settlement = await calculateEarlySettlement(loan, true, now);
      const actualBalance = settlement.outstandingBalance;
      const pipelineDeduction = settlement.pipelineDeduction;
      const pipelineBalance = Math.max(0, actualBalance - pipelineDeduction);

      let frequency = 'Monthly';
      if (loan.metadata) {
        try {
          const meta = typeof loan.metadata === 'string' ? JSON.parse(loan.metadata) : loan.metadata;
          frequency = meta.financialInfo?.salaryFrequency || 'Monthly';
        } catch (e) {}
      }

      console.log(`\nLoan Ref: ${loan.reference} | Company: ${loan.company} | Freq: ${frequency}`);
      console.log(`Employee: ${loan.employeeName}`);
      console.log(`  Actual Balance:      R ${actualBalance.toFixed(2)}`);
      console.log(`  Pipeline Deduction:  R ${pipelineDeduction.toFixed(2)}`);
      console.log(`  Pipeline Balance:    R ${pipelineBalance.toFixed(2)}`);
      
      // Rule 1 Verification
      if (pipelineBalance <= actualBalance) {
        console.log(`  ✅ Rule 1 Passed: Pipeline Balance (R ${pipelineBalance.toFixed(2)}) <= Actual Balance (R ${actualBalance.toFixed(2)})`);
      } else {
        console.log(`  ❌ Rule 1 Failed: Pipeline Balance is greater than Actual Balance!`);
      }

      // Rule 2 Verification
      if (pipelineDeduction === 0) {
        if (pipelineBalance === actualBalance) {
          console.log(`  ✅ Rule 2 Passed: No payroll deductions, Pipeline Balance equals Actual Balance.`);
        } else {
          console.log(`  ❌ Rule 2 Failed: No payroll deductions, but Pipeline Balance != Actual Balance.`);
        }
      } else {
        console.log(`  ℹ️ Deductions made: Pipeline Balance is reduced by R ${pipelineDeduction.toFixed(2)}.`);
      }
    }
  } catch (err) {
    console.error("Verification failed:", err);
  } finally {
    await prisma.$disconnect();
  }
})();
