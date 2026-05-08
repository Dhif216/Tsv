import express from "express";
import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));

// MongoDB Connection with better error handling
mongoose
  .connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 15000,
    retryWrites: true,
    tls: true,
    tlsAllowInvalidCertificates: true,
  })
  .then(() => console.log("✓ MongoDB connected"))
  .catch((err) => {
    console.error("✗ MongoDB error:", err.message);
    console.error("Connection string issue? Check MONGODB_URI in .env");
  });

// Connection event handlers
mongoose.connection.on("disconnected", () => {
  console.error("✗ MongoDB disconnected!");
});

mongoose.connection.on("error", (err) => {
  console.error("✗ MongoDB connection error:", err.message);
});

// Health check endpoint (public - no auth needed)
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Models
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, default: "admin" },
  createdAt: { type: Date, default: Date.now },
});

const feedbackSchema = new mongoose.Schema({
  sessionId: { type: String, index: true },
  name: String,
  email: String,
  shift: { type: String, enum: ["morning", "evening", "night"] },
  category: {
    type: String,
    enum: ["safety", "workload", "equipment", "environment", "organization", "other"],
  },
  severity: { type: String, enum: ["low", "medium", "high"] },
  comment: String,
  is_anonymous: Boolean,
  contact_requested: Boolean,
  reviewed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const Feedback = mongoose.model("Feedback", feedbackSchema);

// Auth middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ detail: "Not authenticated" });

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.userId);
    if (!user) return res.status(401).json({ detail: "User not found" });

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ detail: "Invalid token" });
  }
};

// Routes
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ detail: "Email and password required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !bcryptjs.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ detail: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "24h" });
    res.json({
      access_token: token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  res.json({
    id: req.user._id,
    email: req.user.email,
    name: req.user.name,
    role: req.user.role,
  });
});

app.post("/api/feedback", async (req, res) => {
  try {
    const { name, email, shift, category, severity, comment, is_anonymous, contact_requested, sessionId } = req.body;
    
    // Validate required fields (name, email, comment are optional)
    if (!shift || !category || !severity) {
      return res.status(400).json({ 
        detail: "Missing required fields: shift, category, severity" 
      });
    }
    
    const feedback = new Feedback({
      sessionId,
      name: name || null,
      email: email || null,
      shift,
      category,
      severity,
      comment: comment || "", // Allow empty comment
      is_anonymous: is_anonymous !== false, // Default to true for anonymous
      contact_requested: contact_requested || false,
    });
    
    await feedback.save();
    res.status(201).json(feedback);
  } catch (err) {
    console.error("Error saving feedback:", err.message);
    res.status(400).json({ detail: err.message });
  }
});

app.get("/api/feedback", authMiddleware, async (req, res) => {
  try {
    const feedback = await Feedback.find().sort({ createdAt: -1 });
    res.json(feedback);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.patch("/api/feedback/:id/reviewed", authMiddleware, async (req, res) => {
  try {
    let { id } = req.params;
    id = String(id).trim();
    
    if (!id) {
      return res.status(400).json({ detail: "Invalid ID" });
    }
    
    const reviewed = req.query.reviewed !== "false";
    const feedback = await Feedback.findByIdAndUpdate(
      id,
      { reviewed },
      { new: true }
    );
    
    if (!feedback) {
      return res.status(404).json({ detail: "Feedback not found" });
    }
    
    res.json(feedback);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.patch("/api/feedback/:id/review", authMiddleware, async (req, res) => {
  try {
    let { id } = req.params;
    id = String(id).trim();
    
    if (!id) {
      return res.status(400).json({ detail: "Invalid ID" });
    }
    
    const reviewed = req.query.reviewed !== "false";
    const feedback = await Feedback.findByIdAndUpdate(
      id,
      { reviewed },
      { new: true }
    );
    
    if (!feedback) {
      return res.status(404).json({ detail: "Feedback not found" });
    }
    
    res.json(feedback);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.delete("/api/feedback/:id", authMiddleware, async (req, res) => {
  try {
    let { id } = req.params;
    id = String(id).trim();
    
    if (!id) {
      return res.status(400).json({ detail: "ID is required" });
    }
    
    console.log(`Deleting feedback: ${id}`);
    const feedback = await Feedback.findByIdAndDelete(id);
    
    if (!feedback) {
      console.log(`Feedback not found: ${id}`);
      return res.status(404).json({ detail: "Feedback not found" });
    }
    
    console.log(`✓ Feedback deleted: ${id}`);
    res.json({ message: "Deleted successfully", success: true });
  } catch (err) {
    console.error(`Delete error: ${err.message}`);
    res.status(500).json({ detail: err.message });
  }
});

app.get("/api/stats", authMiddleware, async (req, res) => {
  try {
    const total = await Feedback.countDocuments();
    const uniqueSessions = await Feedback.distinct("sessionId");
    const uniqueWorkers = uniqueSessions.length;
    const reviewed = await Feedback.countDocuments({ reviewed: true });
    const categories = await Feedback.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);
    const severity = await Feedback.aggregate([
      { $group: { _id: "$severity", count: { $sum: 1 } } },
    ]);
    const shifts = await Feedback.aggregate([
      { $group: { _id: "$shift", count: { $sum: 1 } } },
    ]);

    res.json({
      totalFeedback: total,
      uniqueWorkers,
      reviewedFeedback: reviewed,
      by_category: Object.fromEntries(categories.map((c) => [c._id, c.count])),
      by_severity: Object.fromEntries(severity.map((s) => [s._id, s.count])),
      by_shift: Object.fromEntries(shifts.map((s) => [s._id, s.count])),
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get("/api/feedback/stats", authMiddleware, async (req, res) => {
  try {
    const total = await Feedback.countDocuments();
    const uniqueSessions = await Feedback.distinct("sessionId");
    const uniqueWorkers = uniqueSessions.length;
    const reviewed = await Feedback.countDocuments({ reviewed: true });
    const categories = await Feedback.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);
    const severity = await Feedback.aggregate([
      { $group: { _id: "$severity", count: { $sum: 1 } } },
    ]);
    const shifts = await Feedback.aggregate([
      { $group: { _id: "$shift", count: { $sum: 1 } } },
    ]);

    res.json({
      totalFeedback: total,
      uniqueWorkers,
      reviewedFeedback: reviewed,
      by_category: Object.fromEntries(categories.map((c) => [c._id, c.count])),
      by_severity: Object.fromEntries(severity.map((s) => [s._id, s.count])),
      by_shift: Object.fromEntries(shifts.map((s) => [s._id, s.count])),
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Export endpoints
app.get("/api/feedback/export/csv", authMiddleware, async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ createdAt: -1 }).lean();
    
    let csv = "ID,Name,Email,Shift,Category,Severity,Comment,Anonymous,Contact Requested,Reviewed,Created At\n";
    feedbacks.forEach(f => {
      const comment = (f.comment || "").replace(/"/g, '""');
      csv += `"${f._id}","${f.name || ""}","${f.email || ""}","${f.shift || ""}","${f.category || ""}","${f.severity || ""}","${comment}","${f.is_anonymous}","${f.contact_requested}","${f.reviewed}","${f.createdAt.toISOString()}"\n`;
    });
    
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=tsv_feedback.csv");
    res.send(csv);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get("/api/feedback/export/pdf", authMiddleware, async (req, res) => {
  try {
    const PDFDocument = (await import("pdfkit")).default;
    const feedbacks = await Feedback.find().sort({ createdAt: -1 }).lean();
    
    // Group by sessionId
    const grouped = {};
    feedbacks.forEach(f => {
      const sid = f.sessionId || `no-session-${f._id}`;
      if (!grouped[sid]) grouped[sid] = [];
      grouped[sid].push(f);
    });
    
    // Calculate stats
    const uniqueWorkers = Object.keys(grouped).length;
    const reviewed = feedbacks.filter(f => f.reviewed).length;
    const byCategory = {};
    const bySeverity = { low: 0, medium: 0, high: 0 };
    const byShift = {};
    
    // Count category and severity from all feedbacks
    feedbacks.forEach(f => {
      if (f.category) byCategory[f.category] = (byCategory[f.category] || 0) + 1;
      if (f.severity) bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    });
    
    // Count unique workers per shift (not individual feedback items)
    Object.entries(grouped).forEach(([sessionId, items]) => {
      const shift = items[0].shift;
      if (shift) {
        byShift[shift] = (byShift[shift] || 0) + 1;
      }
    });
    
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=tsv_feedback_report.pdf");
    
    doc.on('error', err => {
      console.error('PDF generation error:', err);
      res.status(500).json({ detail: 'PDF generation failed' });
    });
    
    doc.pipe(res);
    
    // ===== HEADER =====
    doc.fontSize(20).font("Helvetica-Bold").text("TSV Workplace Feedback Report", { align: "center" });
    doc.fontSize(10).font("Helvetica").text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
    doc.fontSize(10).font("Helvetica").text(`Report Period: ${feedbacks.length > 0 ? 'All Submissions' : 'No data'}`, { align: "center" });
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
    
    // ===== SUMMARY STATISTICS =====
    doc.fontSize(12).font("Helvetica-Bold").text("SUMMARY STATISTICS");
    doc.moveDown(0.3);
    
    doc.fontSize(10).font("Helvetica");
    doc.text(`Total Submissions: ${feedbacks.length}`);
    doc.text(`Unique Workers: ${uniqueWorkers}`);
    doc.text(`Reviewed: ${reviewed}`);
    doc.text(`Pending Review: ${feedbacks.length - reviewed}`);
    doc.moveDown(0.5);
    
    // ===== BREAKDOWN BY CATEGORY =====
    doc.fontSize(11).font("Helvetica-Bold").text("FEEDBACK BY CATEGORY:");
    doc.fontSize(9).font("Helvetica");
    Object.entries(byCategory).forEach(([cat, count]) => {
      doc.text(`  ${cat.charAt(0).toUpperCase() + cat.slice(1)}: ${count}`);
    });
    doc.moveDown(0.5);
    
    // ===== BREAKDOWN BY SEVERITY =====
    doc.fontSize(11).font("Helvetica-Bold").text("SEVERITY BREAKDOWN:");
    doc.fontSize(9).font("Helvetica");
    Object.entries(bySeverity).forEach(([sev, count]) => {
      doc.text(`  ${sev.charAt(0).toUpperCase() + sev.slice(1)}: ${count}`);
    });
    doc.moveDown(0.5);
    
    // ===== BREAKDOWN BY SHIFT =====
    doc.fontSize(11).font("Helvetica-Bold").text("FEEDBACK BY SHIFT:");
    doc.fontSize(9).font("Helvetica");
    Object.entries(byShift).forEach(([shift, count]) => {
      doc.text(`  ${shift.charAt(0).toUpperCase() + shift.slice(1)}: ${count}`);
    });
    
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
    
    // ===== WORKER SUBMISSIONS =====
    doc.fontSize(12).font("Helvetica-Bold").text("WORKER SUBMISSIONS");
    doc.moveDown(0.3);
    
    let workerNum = 1;
    Object.entries(grouped).forEach(([sessionId, items]) => {
      // Check if we need a new page
      if (doc.y > 650) {
        doc.addPage();
        doc.moveDown(0.5);
      }
      
      // Worker header
      doc.fontSize(10).font("Helvetica-Bold").text(`WORKER #${workerNum}`);
      doc.fontSize(9).font("Helvetica").text(`Session ID: ${sessionId.substring(0, 16)}`);
      
      // Worker info
      const firstItem = items[0];
      doc.fontSize(9).font("Helvetica");
      doc.text(`Status: ${items.every(i => i.reviewed) ? "REVIEWED" : "PENDING"}`);
      doc.text(`Shift: ${firstItem.shift || 'N/A'}`);
      doc.text(`Date: ${new Date(firstItem.createdAt).toLocaleString()}`);
      doc.text(`Answers: ${items.length}`);
      
      doc.moveDown(0.3);
      
      // Worker answers
      items.forEach((item, idx) => {
        doc.fontSize(8).font("Helvetica-Bold");
        doc.text(`${idx + 1}. [${(item.severity || 'N/A').toUpperCase()}] ${(item.category || 'N/A').toUpperCase()}`);
        
        // Comment if exists
        if (item.comment) {
          doc.fontSize(8).font("Helvetica");
          doc.text(`"${item.comment}"`, { width: 400, indent: 10 });
        } else {
          doc.fontSize(8).font("Helvetica").text("(no comment)", { indent: 10 });
        }
        
        doc.moveDown(0.2);
      });
      
      doc.moveDown(0.4);
      doc.moveTo(60, doc.y).lineTo(540, doc.y).stroke();
      doc.moveDown(0.4);
      
      workerNum++;
    });
    
    // ===== FOOTER =====
    doc.moveDown(1);
    doc.fontSize(8).font("Helvetica");
    doc.text("This report was automatically generated from TSV Feedback System", { align: "center" });
    doc.text(`Total items: ${feedbacks.length} | Workers: ${uniqueWorkers}`, { align: "center" });
    
    doc.end();
  } catch (err) {
    console.error('PDF export error:', err);
    if (!res.headersSent) {
      res.status(500).json({ detail: err.message || 'PDF export failed' });
    }
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Seed admin on startup
async function seedAdmin() {
  try {
    const exists = await User.findOne({ email: process.env.ADMIN_EMAIL });
    if (!exists) {
      const user = new User({
        email: process.env.ADMIN_EMAIL,
        name: "TSV Admin",
        passwordHash: bcryptjs.hashSync(process.env.ADMIN_PASSWORD, 10),
        role: "admin",
      });
      await user.save();
      console.log(`✓ Admin created: ${process.env.ADMIN_EMAIL}`);
    } else {
      console.log(`✓ Admin already exists: ${process.env.ADMIN_EMAIL}`);
    }
  } catch (err) {
    console.error("Error seeding admin:", err);
  }
}

// Start server
app.listen(PORT, async () => {
  await seedAdmin();
  console.log(`✓ Backend running on http://localhost:${PORT}`);
});
