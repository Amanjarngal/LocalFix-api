import "dotenv/config";
import mongoose from "mongoose";
import { Renovation } from "./models/renovationSchema.js";
import { Provider } from "./models/providerSchema.js";
import { User } from "./models/userSchema.js";

const verify = async () => {
  try {
    console.log("🔄 Connecting to database...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected!\n");

    // 1. Count renovations
    console.log("═══════════════════════════════════════════");
    console.log("📋 RENOVATION REQUESTS");
    console.log("═══════════════════════════════════════════");
    const totalRenovations = await Renovation.countDocuments();
    const pendingRenovations = await Renovation.countDocuments({ status: 'pending' });
    const acceptedRenovations = await Renovation.countDocuments({ status: 'accepted' });
    
    console.log(`Total:    ${totalRenovations}`);
    console.log(`Pending:  ${pendingRenovations}`);
    console.log(`Accepted: ${acceptedRenovations}\n`);

    if (pendingRenovations > 0) {
      console.log("Sample Pending Requests:");
      const samples = await Renovation.find({ status: 'pending' })
        .select('_id projectTitle city pincode estimatedBudget createdAt')
        .limit(5)
        .populate('customer', 'email');
      
      samples.forEach((r, i) => {
        console.log(`  ${i + 1}. "${r.projectTitle}"`);
        console.log(`     📍 ${r.city} - ${r.pincode}`);
        console.log(`     💰 ₹${r.estimatedBudget}`);
        console.log(`     👤 Customer: ${r.customer?.email || 'N/A'}`);
        console.log("");
      });
    }

    // 2. Count providers
    console.log("═══════════════════════════════════════════");
    console.log("👷 PROVIDER PROFILES");
    console.log("═══════════════════════════════════════════");
    const totalProviders = await Provider.countDocuments();
    const providersWithUser = await Provider.countDocuments({ user: { $exists: true, $ne: null } });
    const providersWithServiceAreas = await Provider.countDocuments({ serviceAreas: { $exists: true, $ne: [] } });

    console.log(`Total:                 ${totalProviders}`);
    console.log(`With User Link:        ${providersWithUser}`);
    console.log(`With Service Areas:    ${providersWithServiceAreas}\n`);

    // 3. List providers
    console.log("Sample Providers:");
    const providers = await Provider.find()
      .select('_id businessName email user serviceAreas')
      .limit(5);
    
    providers.forEach((p, i) => {
      console.log(`  ${i + 1}. "${p.businessName}"`);
      console.log(`     Email: ${p.email}`);
      console.log(`     User ID: ${p.user ? '✅ ' + p.user : '❌ Not linked'}`);
      console.log(`     Service Areas: ${p.serviceAreas?.length || 0}`);
      if (p.serviceAreas?.length > 0) {
        console.log(`     Pincodes: ${p.serviceAreas.map(sa => sa.pincode).join(', ')}`);
      }
      console.log("");
    });

    // 4. Try to find a match
    console.log("═══════════════════════════════════════════");
    console.log("🔍 MATCHING ANALYSIS");
    console.log("═══════════════════════════════════════════");

    if (pendingRenovations > 0 && totalProviders > 0) {
      const firstRequest = await Renovation.findOne({ status: 'pending' });
      const firstProvider = await Provider.findOne();

      console.log(`\nRequest: "${firstRequest.projectTitle}"`);
      console.log(`  📍 Location: ${firstRequest.city}, ${firstRequest.area} (${firstRequest.pincode})`);
      
      console.log(`\nProvider: "${firstProvider.businessName}"`);
      if (firstProvider.serviceAreas?.length > 0) {
        const servicePincodes = firstProvider.serviceAreas.map(sa => sa.pincode);
        const match = servicePincodes.includes(firstRequest.pincode);
        console.log(`  🎯 Pincode Match: ${match ? '✅ YES' : '❌ NO'}`);
        console.log(`  Serves: ${servicePincodes.join(', ')}`);
      } else {
        console.log(`  ⚠️  No service areas configured - provider can see ALL requests`);
      }
    }

    // 5. Summary
    console.log("\n═══════════════════════════════════════════");
    console.log("📊 SUMMARY & RECOMMENDATIONS");
    console.log("═══════════════════════════════════════════");

    const issues = [];

    if (totalRenovations === 0) {
      issues.push("❌ No renovation requests created");
    } else if (pendingRenovations === 0) {
      issues.push("❌ No pending requests (all are accepted/completed)");
    }

    if (totalProviders === 0) {
      issues.push("❌ No provider profiles exist");
    } else if (providersWithUser === 0) {
      issues.push("⚠️  Providers not linked to user accounts");
    }

    if (issues.length === 0) {
      console.log("✅ All systems look good!");
      console.log("\nIf providers still don't see requests:");
      console.log("  1. Check browser console for fetch errors");
      console.log("  2. Run diagnostics from provider dashboard");
      console.log("  3. Check Network tab in browser DevTools");
    } else {
      console.log("\n⚠️  Issues found:\n");
      issues.forEach(issue => console.log(`  ${issue}`));
    }

    console.log("\n═══════════════════════════════════════════");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

verify();
