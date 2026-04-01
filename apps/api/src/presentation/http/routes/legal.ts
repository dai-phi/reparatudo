import type { FastifyInstance } from "fastify";
import { legalDocuments } from "../content/legal-documents.js";

export async function registerLegalRoutes(app: FastifyInstance) {
  app.get("/legal", async (_request, reply) => {
    return reply.send({
      version: legalDocuments.terms.version,
      documents: [
        { slug: legalDocuments.terms.slug, title: legalDocuments.terms.title, path: "/legal/terms" },
        { slug: legalDocuments.privacy.slug, title: legalDocuments.privacy.title, path: "/legal/privacy" },
        { slug: legalDocuments.retention.slug, title: legalDocuments.retention.title, path: "/legal/retention" },
      ],
    });
  });

  app.get("/legal/terms", async (_request, reply) => {
    return reply.send(legalDocuments.terms);
  });

  app.get("/legal/privacy", async (_request, reply) => {
    return reply.send(legalDocuments.privacy);
  });

  app.get("/legal/retention", async (_request, reply) => {
    return reply.send(legalDocuments.retention);
  });
}
