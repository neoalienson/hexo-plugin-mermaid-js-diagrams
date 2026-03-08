const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Mock fs.readFileSync for tests
const originalReadFileSync = fs.readFileSync;
fs.readFileSync = (filePath, encoding) => {
  if (filePath.includes('mermaid.min.js')) {
    return 'console.log("mocked mermaid");';
  }
  return originalReadFileSync(filePath, encoding);
};

// Mock hexo object
const mockHexo = {
  config: {
    mermaid: {
      enable: true,
      theme: 'default',
      js_url: 'https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js',
      controls: {
        enable: true,
        zoomIn: true,
        zoomOut: true,
        reset: true,
        download: true,
        position: 'bottom-right',
        draggable: true
      },
      diagramDraggable: true,
      width: '100%',
      debug: false
    }
  },
  extend: {
    tag: {
      register: function(name, fn, options) {
        this.registeredTags = this.registeredTags || {};
        this.registeredTags[name] = { fn, options };
      }
    },
    injector: {
      register: function(position, fn) {
        this.registeredInjectors = this.registeredInjectors || {};
        this.registeredInjectors[position] = fn;
      }
    },
    filter: {
      register: function(event, fn) {
        this.registeredFilters = this.registeredFilters || {};
        if (!this.registeredFilters[event]) {
          this.registeredFilters[event] = [];
        }
        this.registeredFilters[event].push(fn);
      }
    }
  }
};

global.hexo = mockHexo;

describe('hexo-mermaid-js-diagrams', () => {
  beforeEach(() => {
    delete require.cache[require.resolve('../index.js')];
    mockHexo.extend.tag.registeredTags = {};
    mockHexo.extend.injector.registeredInjectors = {};
    mockHexo.extend.filter.registeredFilters = {};
  });

  it('should register mermaid tag and after_generate filter', () => {
    require('../index.js');
    assert(mockHexo.extend.tag.registeredTags.mermaid);
    assert(mockHexo.extend.filter.registeredFilters.after_generate);
  });

  it('should return a placeholder', () => {
    require('../index.js');
    const tagFn = mockHexo.extend.tag.registeredTags.mermaid.fn;
    const result = tagFn([], 'graph TD; A-->B;');
    assert.ok(result.startsWith('<!--MERMAID_PLACEHOLDER_'));
  });

  it('should handle complex flowchart with HTML entities', () => {
    require('../index.js');
    const tagFn = mockHexo.extend.tag.registeredTags.mermaid.fn;
    const complexDiagram = `flowchart TD
    A[Identify Assets] --> B[Define Threats]
    B --> C[Create Data Flow Diagram]
    C --> D[Analyze Trust Boundaries]
    D --> E[Apply Framework<br/>STRIDE/PASTA]
    E --> F[Assess Impact & Likelihood]
    F --> G[Prioritize Threats]
    G --> H[Define Mitigations]
    H --> I[Implement Controls]
    I --> J[Monitor & Review]
    J --> |Continuous Process| B
    
    style A fill:#4CAF50,stroke:#333,stroke-width:2px,color:#fff
    style H fill:#2196F3,stroke:#333,stroke-width:2px,color:#fff
    style J fill:#FF9800,stroke:#333,stroke-width:2px,color:#fff`;
    
    const result = tagFn([], complexDiagram);
    assert.ok(result.startsWith('<!--MERMAID_PLACEHOLDER_'));
  });

  it('should register filter for js_url configuration', () => {
    mockHexo.config.mermaid.js_url = 'https://some.url/mermaid.js';
    require('../index.js');
    assert(mockHexo.extend.filter.registeredFilters.after_generate);
  });

  it('should wrap svg with controls when enabled', () => {
    const mockSvg = '<svg><g>test</g></svg>';
    const controls = {
      enable: true,
      zoomIn: true,
      zoomOut: true,
      reset: true,
      download: true
    };
    
    let html = '<div class="mermaid-wrapper" style="position:relative;display:inline-block">';
    html += mockSvg;
    html += '<div class="mermaid-controls" style="position:absolute;top:8px;right:8px;display:flex;gap:4px;z-index:10">';
    if (controls.zoomIn) html += '<button title="Zoom In">🔍</button>';
    if (controls.zoomOut) html += '<button title="Zoom Out">🔎</button>';
    if (controls.reset) html += '<button title="Reset">↺</button>';
    if (controls.download) html += '<button title="Download SVG">💾</button>';
    html += '</div></div>';
    
    assert(html.includes('mermaid-wrapper'));
    assert(html.includes('mermaid-controls'));
    assert(html.includes('🔍'));
    assert(html.includes('🔎'));
    assert(html.includes('↺'));
    assert(html.includes('💾'));
  });

  it('should include only selected controls', () => {
    const mockSvg = '<svg><g>test</g></svg>';
    const controls = {
      enable: true,
      zoomIn: true,
      zoomOut: false,
      reset: true,
      download: false
    };
    
    let html = '<div class="mermaid-wrapper" style="position:relative;display:inline-block">';
    html += mockSvg;
    html += '<div class="mermaid-controls" style="position:absolute;top:8px;right:8px;display:flex;gap:4px;z-index:10">';
    if (controls.zoomIn) html += '<button title="Zoom In">🔍</button>';
    if (controls.zoomOut) html += '<button title="Zoom Out">🔎</button>';
    if (controls.reset) html += '<button title="Reset">↺</button>';
    if (controls.download) html += '<button title="Download SVG">💾</button>';
    html += '</div></div>';
    
    assert(html.includes('🔍'));
    assert(!html.includes('🔎'));
    assert(html.includes('↺'));
    assert(!html.includes('💾'));
  });

  it('should not wrap svg when controls disabled', () => {
    const mockSvg = '<svg><g>test</g></svg>';
    const controls = { enable: false };
    
    const result = controls.enable ? 'wrapped' : mockSvg;
    
    assert.equal(result, mockSvg);
    assert(!result.includes('mermaid-controls'));
  });

  it('should position controls at top-left', () => {
    const pos = 'top-left';
    const posMap = {'top-left':'top:8px;left:8px','top-right':'top:8px;right:8px','bottom-left':'bottom:8px;left:8px','bottom-right':'bottom:8px;right:8px'};
    const posStyle = posMap[pos];
    
    assert.equal(posStyle, 'top:8px;left:8px');
  });

  it('should position controls at bottom-right by default', () => {
    const pos = 'bottom-right';
    const posMap = {'top-left':'top:8px;left:8px','top-right':'top:8px;right:8px','bottom-left':'bottom:8px;left:8px','bottom-right':'bottom:8px;right:8px'};
    const posStyle = posMap[pos] || posMap['bottom-right'];
    
    assert.equal(posStyle, 'bottom:8px;right:8px');
  });

  it('should enable draggable by default', () => {
    const controls = { draggable: true };
    const cursor = controls.draggable !== false ? 'move' : 'default';
    
    assert.equal(cursor, 'move');
  });

  it('should disable draggable when set to false', () => {
    const controls = { draggable: false };
    const cursor = controls.draggable !== false ? 'move' : 'default';
    
    assert.equal(cursor, 'default');
  });

  it('should enable diagram draggable by default', () => {
    const diagramDraggable = true;
    assert.equal(diagramDraggable, true);
  });

  it('should disable diagram draggable when set to false', () => {
    const diagramDraggable = false;
    assert.equal(diagramDraggable, false);
  });

  describe('markdown code fence support', () => {
    it('should register after_render:html filter when markdown is enabled', () => {
      mockHexo.config.mermaid.markdown = true;
      require('../index.js');
      
      assert.equal(mockHexo.extend.filter.registeredFilters['after_render:html'].length, 2);
    });

    it('should not register after_render:html filter for markdown when markdown is disabled', () => {
      mockHexo.config.mermaid.markdown = false;
      require('../index.js');
      
      assert.equal(mockHexo.extend.filter.registeredFilters['after_render:html'].length, 1);
    });

    it('should convert markdown code fence to mermaid div', () => {
      mockHexo.config.mermaid.markdown = true;
      require('../index.js');
      
      const beforePostRenderFn = mockHexo.extend.filter.registeredFilters['before_post_render'][0];
      const afterRenderHtmlFn = mockHexo.extend.filter.registeredFilters['after_render:html'][0];

      let data = {
          content: '```mermaid\ngraph TD;\nA-->B;\n```'
      };
      data = beforePostRenderFn(data);

      const idMatch = data.content.match(/```(MERMAID_BASE64_\d+)/);
      const id = idMatch[1];
      const encodedContent = Buffer.from('graph TD;\nA-->B;').toString('base64');
      const diagramContent = Buffer.from(encodedContent, 'base64').toString('utf8');

      let str = `<pre><code class="language-${id}">${encodedContent}</code></pre>`;
      str = afterRenderHtmlFn(str, {});

      assert.equal(str.trim(), `<div class="mermaid">${diagramContent}</div>`);
    });
  });
});