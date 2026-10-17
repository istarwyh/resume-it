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
        setTimeout(blink,delay);
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
  window.addEventListener('load', function () {
    if (!document.body.classList.contains('print')) return;
    if (new URLSearchParams(window.location.search).get('autoprint') !== '1') return;

    // CSS owns A4 layout and pagination. Do not resize or clip the document.
    var fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    fontsReady.then(function () {
      window.setTimeout(function () { window.print(); }, 100);
    });
  });
})();
