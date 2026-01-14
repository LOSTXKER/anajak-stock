import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

async function resetData() {
  console.log('🗑️  Resetting data (keeping users)...\n')
  
  // Delete in order of dependencies
  await prisma.notification.deleteMany({})
  console.log('✅ Notifications deleted')
  
  await prisma.auditLog.deleteMany({})
  console.log('✅ Audit logs deleted')
  
  await prisma.attachment.deleteMany({})
  console.log('✅ Attachments deleted')
  
  await prisma.gRNLine.deleteMany({})
  await prisma.gRN.deleteMany({})
  console.log('✅ GRN deleted')
  
  await prisma.pOTimeline.deleteMany({})
  await prisma.pOLine.deleteMany({})
  await prisma.pO.deleteMany({})
  console.log('✅ PO deleted')
  
  await prisma.pRLine.deleteMany({})
  await prisma.pR.deleteMany({})
  console.log('✅ PR deleted')
  
  await prisma.stockTakeLine.deleteMany({})
  await prisma.stockTake.deleteMany({})
  console.log('✅ Stock takes deleted')
  
  await prisma.movementLine.deleteMany({})
  await prisma.stockMovement.deleteMany({})
  console.log('✅ Movements deleted')
  
  await prisma.stockBalance.deleteMany({})
  console.log('✅ Stock balances deleted')
  
  await prisma.lot.deleteMany({})
  console.log('✅ Lots deleted')
  
  await prisma.variantOptionValue.deleteMany({})
  await prisma.productVariant.deleteMany({})
  await prisma.product.deleteMany({})
  console.log('✅ Products deleted')
  
  await prisma.optionValue.deleteMany({})
  await prisma.optionType.deleteMany({})
  console.log('✅ Options deleted')
  
  await prisma.supplier.deleteMany({})
  console.log('✅ Suppliers deleted')
  
  await prisma.location.deleteMany({})
  await prisma.warehouse.deleteMany({})
  console.log('✅ Warehouses deleted')
  
  await prisma.category.deleteMany({})
  console.log('✅ Categories deleted')
  
  await prisma.unitOfMeasure.deleteMany({})
  console.log('✅ Units deleted')
  
  // Reset document sequences
  await prisma.docSequence.updateMany({
    data: { currentNo: 0 }
  })
  console.log('✅ Document sequences reset to 0')
  
  // Count remaining users
  const userCount = await prisma.user.count()
  console.log(`\n👤 Users preserved: ${userCount}`)
  
  console.log('\n🎉 Data reset complete!')
  console.log('📋 ต่อไป: เพิ่มข้อมูลพื้นฐานใหม่ (หมวดหมู่, หน่วย, คลัง, Supplier)')
  
  await prisma.$disconnect()
}

resetData().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
