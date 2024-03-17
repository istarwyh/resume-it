const gulp = require('gulp')
const path = require('path')
const fs = require('fs')
const matter = require('gray-matter')
const yaml = require('js-yaml')
const MarkdownIt = require('markdown-it')
const markdownItAttrs = require('markdown-it-attrs')
const nib = require('nib')
const $ = require('gulp-load-plugins')()
const browserSync = require('browser-sync').create()
const _ = require('lodash');

const isProd = process.env.NODE_ENV === 'production'
const localDataPath = 'data.yaml'
const archivePath = `archive/${getResumeDataName()}`


function getResumeDataName() {
  const currentDate = new Date();
  const formattedDate = _.chain(currentDate)
      .thru((date) => [
        date.getFullYear().toString(),
        _.padStart((date.getMonth() + 1).toString(), 2, '0'),
        _.padStart(date.getDate().toString(), 2, '0')
      ])
      .join('')
      .value();

  return `resume_data_${formattedDate}.yaml`;
}

const md = new MarkdownIt({
  html: true,
  breaks: true,
  typographer: true
})
md.use(markdownItAttrs)

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

gulp.task('html', () => {
  console.log('----------Starting html-----------');

  const MarkdownType = new yaml.Type('tag:yaml.org,2002:md', {
    kind: 'scalar',
    construct: function (text) {
      return md.render(text)
    },
  })
  const YAML_SCHEMA = yaml.Schema.create([ MarkdownType ])
  const context = matter(fs.readFileSync(localDataPath, 'utf8'), {schema: YAML_SCHEMA }).data
  return gulp.src(['template/index.html', 'template/print.html'])
    .pipe($.nunjucks.compile(context))
    .pipe($.htmlmin({collapseWhitespace: true}))
    .pipe(gulp.dest('dist'))
    .pipe($.size())
})

gulp.task('archive', () => {
  console.log('----------Starting archive process-----------');
  fs.readFile(localDataPath, (err, data) => {
    if (err) throw err;
    fs.writeFile(archivePath, data, (err) => {
      if (err) throw err;
      console.log(`${archivePath} was copied successfully!`);
    });
  });
  return Promise.resolve();
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
    { path: ['template/*.html', localDataPath], task: 'html' },
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


gulp.task(
  'default',
  gulp.series('scripts', 'styles', 'fonts','html','archive', 'watch'))