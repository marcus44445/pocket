var script = document.createElement('script');
script.src = chrome.runtime.getURL('scripts/socket-sniffer.js');
script.onload = function () {
    this.parentNode.removeChild(this);
};
(document.head || document.documentElement).appendChild(script);

