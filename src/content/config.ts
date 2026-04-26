import { defineCollection, z } from 'astro:content';

/**
 * Lesson schema.
 *
 * Every MDX file in src/content/lessons/ must satisfy this schema.
 * The build will fail if a lesson is missing required fields or has a
 * field of the wrong type.
 *
 * When adding a new field:
 *   1. Add it here.
 *   2. Document it in CLAUDE.md under "Lesson pattern".
 *   3. Update the example lesson and any lesson templates.
 */
const lessons = defineCollection({
  type: 'content',
  schema: z.object({
    /** Display title shown at the top of the lesson and in the index. */
    title: z.string().min(1).max(80),

    /** Top-level learning track the lesson belongs to. */
    track: z.enum([
      'it-basics', // From NAND gates and hardware up through operating systems
      'artificial-intelligence', // How modern AI systems work
      'programming', // Writing software
    ]),

    /** Sub-module within a track. Optional — used to group related lessons inside a track. */
    module: z.string().optional(),

    /** Position within the track. Determines lesson order. Must be unique within a track. */
    order: z.number().int().positive(),

    /** Estimated time to complete in minutes. Aim for 5–10. */
    duration: z.number().int().positive().max(30),

    /**
     * Slugs of lessons that should be completed before this one.
     * Used to enforce ordering and to show "you should do X first" hints.
     */
    prerequisites: z.array(z.string()).default([]),

    /**
     * Concrete things the learner will be able to do after this lesson.
     * Shown at the top of the lesson and used for the comprehension check.
     * 2–4 objectives is the sweet spot.
     */
    objectives: z.array(z.string()).min(1).max(5),

    /**
     * Names of interactive components used in this lesson.
     * Used for analytics-free auditing: lets us check which components are in use
     * and run their tests when the lesson changes.
     */
    components: z.array(z.string()).default([]),

    /** Hide from the index but keep building. Use during authoring. */
    draft: z.boolean().default(false),
  }),
});

export const collections = { lessons };
