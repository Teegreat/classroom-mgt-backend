import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import express from "express";
import { subjects, departments } from "../db/schema";
import { db } from "../db";

const router = express.Router();

// Define your subject routes here
// get all subjects with optional search, filtering, pagination, etc.
router.get("/", async (req, res) => {
  try {
    const { search, department, page, limit } = req.query;

    const pageParam = Array.isArray(page) ? page[0] : page;
    const limitParam = Array.isArray(limit) ? limit[0] : limit;

    const parsedPage = Number.parseInt(
      typeof pageParam === "string" ? pageParam : "1",
      10,
    );
    const parsedLimit = Number.parseInt(
      typeof limitParam === "string" ? limitParam : "10",
      10,
    );

    if (!Number.isFinite(parsedPage) || !Number.isFinite(parsedLimit)) {
      return res.status(400).json({ error: "Invalid pagination parameters" });
    }

    const currentPage = Math.max(1, parsedPage);
    const limitPerPage = Math.max(1, parsedLimit);

    const offset = (currentPage - 1) * limitPerPage;

    const filterConditions = [];

    // if search query is provided, filter by subject name or subject code
    if (search) {
      filterConditions.push(
        or(
          ilike(subjects.name, `%${search}%`),
          ilike(subjects.code, `%${search}%`),
        ),
      );
    }

    // if department filter is provided, filter by department name
    if (department) {
      const deptPattern = `%${String(department).replace(/[%_]/g, "\\$&")}%`;
      filterConditions.push(ilike(departments.name, deptPattern));
    }

    // combine all filter conditions using AND
    const whereClause =
      filterConditions.length > 0 ? and(...filterConditions) : undefined;

    const countResult = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(whereClause);

    const totalCount = Number(countResult[0]?.count ?? 0);

    const subjectsList = await db
      .select({
        ...getTableColumns(subjects),
        department: { ...getTableColumns(departments) },
      })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(whereClause)
      .orderBy(desc(subjects.createdAt))
      .limit(limitPerPage)
      .offset(offset);

    res.status(200).json({
      data: subjectsList,
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage),
      },
    });
  } catch (error) {
    console.error(`GET /subjects error: ${error}`);
    res.status(500).json({ error: "Failed to get subjects" });
  }
});

export default router;
