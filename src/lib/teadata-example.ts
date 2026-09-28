export interface CampusRow {
  id: string; name: string; district: string; rating: string;
   beginningTeachers: number | null;
}

/** Browser view of the exported snapshot; checked against Python/teadata queries. */
export function selectCampuses(rows: CampusRow[], district: string, rating: string, minimum: number) {
  return rows.filter((r) => r.district === district && (rating === "all" || r.rating === rating)
    && r.beginningTeachers !== null && r.beginningTeachers >= minimum)
    .sort((a, b) => (b.beginningTeachers! - a.beginningTeachers!) || a.id.localeCompare(b.id))
    .slice(0, 10);
}
