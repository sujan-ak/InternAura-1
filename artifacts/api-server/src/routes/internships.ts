import { Router, type Response, type Request } from "express";
import { db, ensureTables, internshipsTable } from "@workspace/db";
import { seedDatabase } from "@workspace/db/seed";

const router = Router();

router.get("/internships", async (_req: Request, res: Response) => {
  try {
    await ensureTables();
    let internships = await db.select().from(internshipsTable);
    if (internships.length === 0) {
      await seedDatabase();
      internships = await db.select().from(internshipsTable);
    }
    return res.json(internships);
  } catch (error) {
    console.error("Error in GET /internships:", error);
    return res.status(500).json({ error: "Failed to list internships" });
  }
});

export default router;
