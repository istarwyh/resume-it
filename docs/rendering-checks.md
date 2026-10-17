# Resume rendering and print checks

The four public entry pages share `template/resume-content.html`. Work sections use
`expert`; standalone projects use `project`. Display labels are not type identifiers:
renaming or translating a section must not remove its projects.

Print pages use 10.5pt body text, A4 margins, and natural pagination. They intentionally
do not promise one page. Portraits and project illustrations are hidden only in print;
all resume text and working links remain. The web layout keeps its sidebar and images.
To create a shorter application resume, edit a separate content selection rather than
shrinking this full version. Change the `pdf_label` block to customize the export button.

## Run

Requires Node.js 22 and the existing npm dependencies. The repository does not yet
have a lockfile; dependency locking is outside this rendering fix.

```sh
npm install
npm test
npx playwright install --with-deps chromium
# Debian/Ubuntu, for PDF text checks and consistent Chinese fonts:
sudo apt-get install poppler-utils fonts-noto-cjk
npm run test:browser
```

`npm test` runs the production Gulp build before checking every project on all four
pages, label-independent sections, profile links, page language, and print safeguards.
The browser check exports Chinese and English PDFs, verifies all project headings and
the final skill in their extracted text, checks font size and horizontal overflow,
tests a deliberately extended resume, and verifies the automatic print action.
Artifacts are saved under `test-results/` and uploaded by the pull-request workflow.

The checks do not publish to `gh-pages`. Changes to metric definitions, project
responsibilities, education facts, and project positioning require separate content
review. Existing data files, including the Business Harness content PR, are untouched.
