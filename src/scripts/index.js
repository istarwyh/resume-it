$(document).ready(function(){
    var $leftEye = $('.left-eye');
    var $rightEye = $('.right-eye');
    var $rightEyebrow = $('.right-eyebrow');
    var $leftEyebrow = $('.left-eyebrow');

    $rightEye.css('transform-origin','50% 50%');
    $leftEye.css('transform-origin','50% 50%');

    var delay = Math.floor(Math.random() * 6000) + 1000;

    function blink(){

        $rightEye.velocity({scaleY : 0.1},{delay:300, duration:0});
        $leftEye.velocity({scaleY : 0.1},{delay:300, duration:0});
        $rightEye.velocity({scaleY : 1},{delay:100, duration:0});
        $leftEye.velocity({scaleY : 1},{delay:100, duration:0});

        $rightEye.velocity({scaleY : 0.1},{delay:100, duration:0});
        $leftEye.velocity({scaleY : 0.1},{delay:100, duration:0});
        $rightEye.velocity({scaleY : 1},{delay:200, duration:0});
        $leftEye.velocity({scaleY : 1},{delay:200, duration:0});

      var blinking = setTimeout(blink,delay);
      delay = delay + 300;
    }
    blink();

    $('svg').on('mouseenter',function(){
      $rightEyebrow.velocity({translateY : -10},{delay:0, duration:300});
      $leftEyebrow.velocity({translateY : 2.5},{delay:0, duration:300});
    });
    $('svg').on('mouseleave',function(){
      $rightEyebrow.velocity({translateY:0},{delay:0, duration:200});
      $leftEyebrow.velocity({translateY:0},{delay:0, duration:200});
    });
  });


(function () {
  var A4_WIDTH_PX = 210 * 96 / 25.4;
  var A4_HEIGHT_PX = 297 * 96 / 25.4;

  function fitPrintResumeToA4() {
    if (!document.body.classList.contains('print')) return;

    var container = document.querySelector('.container');
    if (!container) return;

    document.body.classList.remove('fit-a4');
    var main = document.querySelector('.main');
    var sidebar = document.querySelector('.sidebar');
    var contentWidth = container.offsetWidth;
    var contentHeight = Math.max(
      container.scrollHeight,
      main ? main.scrollHeight : 0,
      sidebar ? sidebar.scrollHeight : 0
    );
    var scale = Math.min(
      A4_WIDTH_PX / contentWidth,
      A4_HEIGHT_PX / contentHeight,
      1
    ) * 0.995;

    document.documentElement.style.setProperty('--a4-scale', scale.toFixed(4));
    document.body.classList.add('fit-a4');
  }

  window.addEventListener('beforeprint', fitPrintResumeToA4);

  window.addEventListener('load', function () {
    if (!document.body.classList.contains('print')) return;
    fitPrintResumeToA4();

    var params = new URLSearchParams(window.location.search);
    if (params.get('autoprint') === '1') {
      window.setTimeout(function () {
        fitPrintResumeToA4();
        window.print();
      }, 350);
    }
  });
})();
