# Patsnap: Lead Engineer, AI Agent Systems

English role-specific resume, published with the owner's authorization. The default Chinese and English resumes are unchanged.

- [Homepage layout PDF](documents/Wang-Yihui-Patsnap-Agent-Systems-EN-Homepage.pdf): green sidebar, portrait and project timeline; one custom-size page.
- [A4 PDF](documents/Wang-Yihui-Patsnap-Agent-Systems-EN.pdf): two pages using the existing print template.
- [Target](targets/patsnap-lead-agent-systems.json)
- [English variant](variants/patsnap-lead-agent-systems-en.json)

The variant uses existing project IDs and separates supported, partial and unknown JD requirements. It does not claim strong Python expertise, a fully independently implemented agent loop, or formal direct-report management. The PDFs were checked against the existing resume and visually inspected. Owner fact attestation is not recorded; `review` remains null. No application has been sent.

From the repository root:

```bash
npm install
export RESUME_WORKSPACE="$PWD/applications"
npm run resume -- init
npm run resume -- inspect patsnap-lead-agent-systems-en
# After personally checking the facts:
npm run resume -- review patsnap-lead-agent-systems-en --reviewer "your name"
npm run resume -- build patsnap-lead-agent-systems-en --pdf
```

The committed PDFs are the 2026-10-31 prepared documents. `build --pdf` creates a new A4 export; it does not replace these files or reproduce the custom-size homepage PDF. Generated exports, submission histories, feedback and decisions are ignored by Git here. GitHub Pages still builds only the default resume; these documents are downloadable from this repository without changing the homepage.
