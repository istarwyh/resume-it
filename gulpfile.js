const gulp = require('gulp')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const nib = require('nib')
const $ = require('gulp-load-plugins')()
const browserSync = require('browser-sync').create()

const isProd = process.env.NODE_ENV === 'production'
const chineseDataPath = 'data.yaml'
const englighDataPath = 'data-en.yaml'
const paths = {
  root: path.join(__dirname, '../'),
  src: path.join(__dirname, '../src/'),
  scripts: 'src/scripts/*.js',
  styles: 'src/styles/**/*.styl',
  assets: path.join(__dirname, '../src/assets'),
}

gulp.task('fonts', function() {
  console.log('----------Starting fonts-----------');

  return gulp.src([
      'node_modules/font-awesome/fonts/fontawesome-webfont.*'])
    .pipe(gulp.dest('dist/fonts/'))
    .pipe($.size())
})

gulp.task('scripts', () => {
  console.log('----------Starting scripts-----------');

  return gulp.src([
      'node_modules/jquery/dist/jquery.min.js',
      'node_modules/velocity-animate/velocity.js',
      paths.scripts
    ])
    .pipe($.uglify())
    .pipe($.concat({ path: 'scripts.js', stat: { mode: 0o666} }))
    .pipe(gulp.dest('dist/assets/'))
    .pipe($.size())
})

gulp.task('styles', () => {
  console.log('----------Starting styles-----------');

  return gulp.src([
      'node_modules/font-awesome/css/font-awesome.min.css',
      paths.styles
    ])
    .pipe($.stylus({ use: nib(), compress: true, import: ['nib']}))
    .pipe($.autoprefixer({
			browsers: ['last 2 versions'],
			cascade: false
		}))
    .pipe($.concat({ path: 'styles.css', stat: { mode: 0o666} }))
    .pipe(gulp.dest('dist/assets/'))
    .pipe($.size())
})

gulp.task('html', async () => {
  const nunjucks = require('nunjucks');
  const { catalog } = require('./lib/resume.cjs');
  const env = nunjucks.configure('template', { autoescape: true });
  const assetVersion = crypto.createHash('sha256').update(Buffer.concat([
    fs.readFileSync('dist/assets/styles.css'), fs.readFileSync('dist/assets/scripts.js')
  ])).digest('hex').slice(0, 12);
  for (const locale of ['zh', 'en']) {
    const data = catalog(locale).data;
    data.asset_version = assetVersion;
    for (const page of locale === 'zh' ? ['index.html', 'print.html'] : ['index-en.html', 'print-en.html']) {
      fs.writeFileSync(path.join('dist', page), env.render(page, data));
    }
  }
})

gulp.task('images', () => {
  console.log('----------Starting images-----------');

  return gulp.src('src/assets/images/**/*')
    .pipe(gulp.dest('dist/assets/images/'))
    .pipe($.size())
})

gulp.task('watch', () => {
  if (isProd) {
    console.log('Skipping watch task in production environment');
    return Promise.resolve();
  }

  console.log('Starting watch task in development environment');

  browserSync.init({
    server: "./dist"
  });

  const watchTargets = [
    { path: paths.scripts, task: 'scripts' },
    { path: paths.styles, task: 'styles' },
    { path: ['template/*.html', chineseDataPath,englighDataPath], task: 'html' },
    { path: 'src/assets/images/**/*', task: 'images' },
    { path: ["dist/*.html", "dist/assets/*.*"], task: null }
  ];

  watchTargets.forEach(target => {
    if (target.task) {
      gulp.watch(target.path, gulp.series(target.task));
    } else {
      gulp.watch(target.path).on('change', browserSync.reload);
    }
  });

  return Promise.resolve();
});


// Tests need production assets, but must not create or overwrite source archives.
gulp.task('clean', async () => {
  fs.rmSync(path.join(__dirname, 'dist'), { recursive: true, force: true });
})
gulp.task('seal', async () => require('./lib/public-output.cjs').seal())
gulp.task('build', gulp.series('clean', 'scripts', 'styles', 'fonts', 'images', 'html', 'seal'))

gulp.task('default', gulp.series('build', 'watch'))
