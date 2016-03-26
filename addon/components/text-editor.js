import Ember from 'ember';
import layout from '../templates/components/text-editor';

const { $, RSVP, computed, on, run } = Ember;

export default Ember.Component.extend({

  /* Options */

  editorApiBaseUrl: 'https://cdn.jsdelivr.net/ace',
  editorApiVersion: '1.2.0',
  language: 'js',
  tabSize: 2,
  theme: 'monokai',

  /* Actions */

  editorDependenciesDidLoad: null,
  editorDidRender: null,

  /* Properties */

  classNames: ['code-editor', 'loaded'],
  editor: null,
  layout: null,

  baseUrl: computed(function() {
    const { editorApiBaseUrl, editorApiVersion } = this.getProperties(
      [ 'editorApiBaseUrl', 'editorApiVersion' ]
    );

    return `${editorApiBaseUrl}/${editorApiVersion}/noconflict/`;
  }),

  content: computed(function(key, value) {
    const editor = this.get('editor');

    if (editor) {
      if (!value) {
        return editor.getSession().getValue();
      }

      const cursor = editor.getCursorPosition();

      editor.getSession().setValue(value);
      editor.moveCursorToPosition(cursor);
    }

    return value;
  }),

  /* Methods */

  init() {
    this._super(...arguments);
    this.loadEditorApi();
  }

  loadEditorApi() {
    const baseUrl = this.get('baseUrl');

    /* Ensure the core library loads before the extras */

    if (!window.ace) {
      this._getScript(`${baseUrl}ace.js`).then(() => {
        this.loadEditorExtras();
      });
    } else {
      this.loadEditorExtras().then(() => {
        this.sendAction('editorDependenciesDidLoad');
        this.renderEditor();
      });
    }
  },

  loadEditorExtras() {
    return new RSVP.Promise((resolve, reject) => {
      const { baseUrl, language, theme } = this.getProperties(
        [ 'baseUrl', 'language', 'theme' ]
      );
      const extrasPromises = [];
      const extras = {
        mode: `mode-${language}`,
        theme: `theme-${theme}`,
      };

      Object.keys(extras).forEach((option) => {
        const fileName = extras[option];
        const modulePath = `ace/${option}/${fileName}`;

        /* For each extra required, check if it exists
        (i.e. it has already been loaded)... */

        if (!window.ace.require(modulePath)) {

          /* ... If not, load it, and push the promise
          to an array to track load progress */

          const promise = this._getScript(`${baseUrl}${fileName}.js`);

          extrasPromises.push(promise);
        }
      });

      /* Then, once the extras are finished loading, render
      the editor */

      RSVP.allSettled(extrasPromises).then(resolve, reject);
    });
  },

  renderEditor() {
    run.scheduleOnce('render', this, function() {
      const { content, element, language, tabSize, theme } = this.getProperties(
        [ 'content', 'element', 'language', 'tabSize', 'theme' ]
      );

      const ace = window.ace;
      const editor = ace.edit(element);
      const editorSession = editor.getSession();

      editor.setTheme(`ace/theme/${theme}`);
      editor.$blockScrolling = Infinity;
      editor.on('change', () => {
        this.notifyPropertyChange('content');
      });

      editorSession.setMode(`ace/mode/${language}`);
      editorSession.setTabSize(tabSize);
      editorSession.setValue(content);

      this.sendAction('editorDidRender');

      this.set('editor', editor);
      this.set('content', content);
    });
  },

  teardownEditor() {
    const editor = this.get('editor');

    if (editor) {
      editor.destroy();
    }
  },

  willDestroyElement() {
    this._super(...arguments);
    this.teardownEditor();
  },

  /**
  Loads any asset at a given URL.

  @method getScript
  @private
  @return Ember.RSVP.Promise
  */

  _getScript(url) {
    return new RSVP.Promise(function(resolve, reject) {
      $.getScript(url).done(resolve).fail(reject);
    });
  },

});
