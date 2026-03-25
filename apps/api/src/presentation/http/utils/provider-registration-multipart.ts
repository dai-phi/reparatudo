import type { FastifyRequest } from "fastify";

export type ParsedProviderRegistrationFiles = {
  fields: Record<string, string>;
  profilePhoto: { buffer: Buffer; mimetype: string } | null;
  verificationDocument: { buffer: Buffer; mimetype: string } | null;
};

export async function parseProviderRegistrationMultipart(request: FastifyRequest): Promise<ParsedProviderRegistrationFiles> {
  const fields: Record<string, string> = {};
  let profilePhoto: ParsedProviderRegistrationFiles["profilePhoto"] = null;
  let verificationDocument: ParsedProviderRegistrationFiles["verificationDocument"] = null;

  const parts = request.parts();
  for await (const part of parts) {
    if (part.type === "file") {
      const buffer = await part.toBuffer();
      if (part.fieldname === "profilePhoto") {
        profilePhoto = { buffer, mimetype: part.mimetype };
      } else if (part.fieldname === "verificationDocument") {
        verificationDocument = { buffer, mimetype: part.mimetype };
      }
    } else {
      fields[part.fieldname] = String(part.value ?? "");
    }
  }

  return { fields, profilePhoto, verificationDocument };
}
