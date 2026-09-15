/*
 * 寸法転記ツール — 抽出・照合エンジン（元Python: 寸法転記スクリプト.py の忠実移植）
 *
 * ブラウザ・Node両対応。ブラウザ用の DOMParser が無い環境（Node単体テスト）では
 * 簡易HTMLテキスト化フォールバックを使う（loadDomParser参照）。
 *
 * 移植範囲: 元ツールのアパレル/雑貨/ランジェリー系の寸法抽出・SKU照合・
 * 透け感転記・バスト身幅比率判定。
 * 除外範囲（意図的）: v126以降で追加された寝具（ベッド/マットレス）・家具・ペット用品専用の
 * WHD(幅×奥行×高さ)寸法サブシステム（v126〜v138群）。これはAIタッガー利用者（EC/アパレル中心）の
 * 想定用途から外れる家具カテゴリ専用ロジックのため、今回は移植対象外とした。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DimensionEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ========================================================================
  // 定数
  // ========================================================================

  var ITEM_KEY_COL = '商品管理番号（商品URL）';
  var ITEM_NAME_COL = '商品名';
  var SKU_COL = 'SKU管理番号';
  var VARIATION_1_COL = 'バリエーション項目選択肢1';
  var VARIATION_2_COL = 'バリエーション項目選択肢2';
  var DESCRIPTION_COL = 'スマートフォン用商品説明文';
  var PC_DESCRIPTION_COL = 'PC用商品説明文';
  var GENRE_ID_COL = 'ジャンルID';

  var OUTPUT_VARIATION_1_COL = '寸法転記後_選択肢1';
  var OUTPUT_VARIATION_2_COL = '寸法転記後_選択肢2';
  var OUTPUT_PATTERN_COL = '採用した抽出パターン';
  var OUTPUT_MATCH_SIZE_COL = '照合した説明文サイズキー';
  var OUTPUT_STATUS_COL = '寸法転記ステータス';
  var OUTPUT_SKU_NORMALIZED_SIZE_COL = 'SKU側正規化サイズ';
  var OUTPUT_DESCRIPTION_SIZE_LIST_COL = '説明文側抽出サイズ一覧';
  var OUTPUT_MATCH_CANDIDATES_COL = '照合候補サイズ';
  var OUTPUT_UNTRANSFERRED_MEMO_COL = '未転記診断メモ';

  var DIMENSION_LABEL_WORDS = [
    'ブルゾンB', 'ライナーB', 'B',
    'プラットフォーム', 'ストームの高さ', 'ストーム高', 'ストーム',
    'バスト', '胸囲', 'チェスト', '胸回り', 'トップバスト', 'アンダーバスト',
    '渡り幅', '渡り巾', 'ひざ幅', 'ヒザ幅', '膝幅',
    '着丈', '後着丈', '身丈', '背丈', '肩幅', '背肩幅', '身幅',
    '袖丈', '裄丈', 'ゆき丈', '総丈', '後丈', '後ろ股上', '股上丈', '股上', '股下丈', '股下',
    '裾幅', '胴回り', 'ウエスト幅', 'ウエスト上がり', 'ウェスト幅', '前股上', '足口幅', '腰幅',
    'ワタリ', 'ウェスト', 'わたり周り', 'わたり巾', 'わたり幅', 'わたり', 'ウエスト',
    'ウエスト最大伸ばし', 'ヒップ', 'スカート丈', 'パンツ丈', 'もも周り',
    '腕ぐり', '腕まわり', 'アームホール', '袖口ゴム幅', '袖口幅', '二の腕幅',
    '裾ゴム周り', '裾周り', '首周り', '首回り', '手囲い', '手周り', '手回り',
    '頭周り', '頭周', '天幅', '高さ', '対応足サイズ', '足サイズ',
    '踵からの高さ', 'かかとからの高さ', '縦',
    'レンズ横幅', 'レンズ縦幅', '鼻幅', 'フレーム幅', 'テンプル',
    '横巾', '横幅', '横', 'よこ', 'たて', '奥行き', '奥行', '幅',
    '持手上', '持ち手高さ', '持ち手', '持手',
    '肩ひも', '肩紐', '首紐', '腰紐', '紐',
    'ショルダー', 'ショルダー対応サイズ', 'ショルダー長さ', 'ショルダー最短', 'ショルダー最長',
    'ストラップ', 'まち', 'マチ', '全長', '足幅',
    'ヒールの高さ', 'ヒール高', 'ソール', '丈', 'アウトソール', 'ソールの高さ',
    '筒丈', '筒周り', 'もも幅', 'そで丈', '前下がり', '持ち手立ち上がり',
    '頭囲', 'つば', 'ツバ', '親骨', '身巾', '肩巾', '裾巾', '袖幅', '袖巾', '胸巾',
    '上横部', '底横部', '上横幅', '上部幅', '下部幅', '底横幅', '底幅', '口幅',
    'ポスト長', 'トップ', '直径', '上部直径', '底部直径', '長さ', '紐部分長さ',
    'フリンジ', '深さ', '外寸', '内寸', '大きさ', '厚さ', 'タテ', 'ヨコ',
    'リング金具内径', '金具内径', '内径', '内周',
    'ケースサイズ', 'ケース縦', 'ケース横', 'ケース厚', 'ベルト最大', '太さ',
    'コード部分', 'コード', 'メタルパーツ', '頭口巾置き寸', '頭口巾', '頭口幅',
    'すそ周り', 'ゆき', 'バスト寸', '裾寸', '袖口'
  ];

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  var DIMENSION_LABEL_RE_SRC = '(?:' +
    DIMENSION_LABEL_WORDS.slice().sort(function (a, b) { return b.length - a.length; })
      .map(escapeRe).join('|') + ')';

  var SIZE_SYMBOL_RE_SRC =
    '(?:' +
    'XXS|XS|SS|MS|LS|PS|S|M|L|(?:[2-9]|1[0-9])XL|XL|XXL|XXXL|XXXXL|LL|(?:[2-9]|1[0-9])L|(?:[2-9]|1[0-9])LT|LT|LLT|ML|MT|ST|S-M|XS-S|S-XS|S/XS|XS/S|' +
    'X-SMALL|X SMALL|XSMALL|EXTRA\\s*SMALL|' +
    'XX-SMALL|XX SMALL|XXSMALL|2X-SMALL|2X SMALL|2XSMALL|' +
    'X-LARGE|X LARGE|XLARGE|EXTRA\\s*LARGE|' +
    'XX-LARGE|XX LARGE|XXLARGE|2X-LARGE|2X LARGE|2XLARGE|' +
    'XXX-LARGE|XXX LARGE|XXXLARGE|3X-LARGE|3X LARGE|3XLARGE|' +
    '(?:T|P)\\d{1,2}|マタニティ\\s*(?:S|M|L|M\\s*[-~〜～]\\s*L|L\\s*[-~〜～]\\s*LL)|' +
    'FREE|F|フリー|ワンサイズ|ONE\\s*SIZE|ONESIZE|ONE|' +
    'SMALL|MEDIUM|LARGE|' +
    '\\d{1,3}(?:\\.\\d+)?\\s*[-~〜～]\\s*\\d{1,3}(?:\\.\\d+)?(?:cm|CM)?|' +
    '\\d{1,2}H|\\d{1,2}S|BM|BL|' +
    '\\d{1,3}(?:\\.\\d+)?(?:号|インチ|INCH|inch)?|' +
    '\\d{1,3}(?:\\.\\d+)?cm' +
    ')';

  function reDIM(flags) { return new RegExp(DIMENSION_LABEL_RE_SRC, flags || ''); }
  function reSIZE(flags) { return new RegExp(SIZE_SYMBOL_RE_SRC, flags || ''); }

  // ========================================================================
  // 基本正規化ヘルパー
  // ========================================================================

  function unescapeHtml(s) {
    if (!s) return '';
    var ta = (typeof document !== 'undefined') ? document.createElement('textarea') : null;
    if (ta) { ta.innerHTML = s; return ta.value; }
    // Node フォールバック（主要参照のみ）
    return String(s)
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  }

  function nfkc(s) {
    try { return String(s == null ? '' : s).normalize('NFKC'); }
    catch (e) { return String(s == null ? '' : s); }
  }

  function normalizeText(text) {
    var t = String(text == null ? '' : text);
    t = unescapeHtml(t);
    t = nfkc(t);
    t = t.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n');
    t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    t = t.replace(/　/g, ' ');
    t = t.replace(/[ \t]+/g, ' ');
    t = t.replace(/ *\n */g, '\n');
    t = t.replace(/\n{3,}/g, '\n\n');
    return t.trim();
  }

  function normalizeOneLine(text) {
    var t = normalizeText(text);
    t = t.replace(/\n/g, ' ');
    t = t.replace(/\s+/g, ' ');
    return t.trim();
  }

  function normalizeOneLinePreserveForm(text) {
    var t = String(text == null ? '' : text);
    t = unescapeHtml(t);
    t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    t = t.replace(/　/g, ' ');
    t = t.replace(/[ \t]+/g, ' ');
    t = t.replace(/\n/g, ' ');
    t = t.replace(/\s+/g, ' ');
    return t.trim();
  }

  function formatNumber(value) {
    value = parseFloat(value);
    if (Number.isInteger(value)) return String(value);
    var s = String(value);
    s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
  }

  var RANGE_SEP_CLASS = '[~〜～\\-－−ー―‐–—?]';

  function normalizeRangeSeparators(text) {
    var t = normalizeOneLine(text);
    if (!t) return '';
    return t.replace(new RegExp(RANGE_SEP_CLASS, 'g'), '~');
  }

  function extractMaxNumber(valueText) {
    var t = normalizeRangeSeparators(valueText);
    var nums = t.match(/\d+(?:\.\d+)?/g);
    if (!nums) return '';
    var values = nums.map(parseFloat);
    return formatNumber(Math.max.apply(null, values));
  }

  function cleanDimensionLabel(label) {
    var l = normalizeOneLine(label);
    l = l.replace(/^[■□◆◇●○・※\s]+/, '');
    l = l.replace(/^[\s:：/／|｜]+|[\s:：/／|｜]+$/g, '');
    return l;
  }

  function normalizeOutputLabel(label) {
    var l = cleanDimensionLabel(label);
    var map = { 'W': '幅', 'Ｗ': '幅', 'H': '高さ', 'Ｈ': '高さ', 'D': '奥行', 'Ｄ': '奥行', 'タテ': '縦', 'ヨコ': '横' };
    return map.hasOwnProperty(l) ? map[l] : l;
  }

  // ========================================================================
  // HTML → テキスト（元 HtmlTextParser 相当）
  // ブロック要素/br/tr/table/p/div の開始・終了で改行、th/tdでタブを挿入する。
  // ========================================================================

  var BLOCK_TAGS = { BR: 1, TR: 1, TABLE: 1, P: 1, DIV: 1 };
  var CELL_TAGS = { TH: 1, TD: 1 };

  function domParserAvailable() {
    return typeof DOMParser !== 'undefined';
  }

  function htmlToText(htmlText) {
    var raw = String(htmlText == null ? '' : htmlText);
    if (!raw) return '';
    if (domParserAvailable()) {
      var doc = new DOMParser().parseFromString('<div id="__root__">' + raw + '</div>', 'text/html');
      var root = doc.getElementById('__root__');
      var parts = [];
      (function walk(node) {
        if (node.nodeType === 3) { // TEXT_NODE
          parts.push(node.nodeValue);
          return;
        }
        if (node.nodeType !== 1) return; // ELEMENT_NODE only
        var tag = node.tagName;
        var isBlock = BLOCK_TAGS[tag];
        var isCell = CELL_TAGS[tag];
        if (isBlock) parts.push('\n');
        if (isCell) parts.push('\t');
        for (var i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]);
        if (isBlock && tag !== 'BR') parts.push('\n');
        if (isCell) parts.push('\t');
      })(root);
      return normalizeText(parts.join(''));
    }
    // Node フォールバック: 簡易タグ置換
    var text = raw
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(tr|table|p|div)>/gi, '\n')
      .replace(/<(tr|table|p|div)[^>]*>/gi, '\n')
      .replace(/<\/(t[hd])>/gi, '\t')
      .replace(/<(t[hd])[^>]*>/gi, '\t')
      .replace(/<[^>]+>/g, '');
    return normalizeText(text);
  }

  // HTMLテーブル抽出（<table>ごとに行×セルの2次元配列）
  function extractTables(htmlText) {
    var raw = String(htmlText == null ? '' : htmlText);
    if (!raw || !domParserAvailable()) return [];
    var doc = new DOMParser().parseFromString('<div id="__root__">' + raw + '</div>', 'text/html');
    var root = doc.getElementById('__root__');
    var tables = [];
    var tableEls = root.querySelectorAll('table');
    tableEls.forEach(function (tableEl) {
      var rows = [];
      var trEls = tableEl.querySelectorAll('tr');
      trEls.forEach(function (tr) {
        var cells = [];
        var cellEls = tr.querySelectorAll('th,td');
        cellEls.forEach(function (cell) {
          cells.push(normalizeOneLine(cell.textContent || ''));
        });
        if (cells.length) rows.push(cells);
      });
      if (rows.length) tables.push(rows);
    });
    return tables;
  }

  // ========================================================================
  // サイズ記号の正規化・同義語（get_size_aliases / normalize_size_symbol）
  // ========================================================================

  var ALIAS_MAP = {
    'XXS': ['2XS', 'XX-SMALL', 'XX SMALL', 'XXSMALL', '2X-SMALL', '2X SMALL', '2XSMALL'],
    '2XS': ['XXS', 'XX-SMALL', 'XXSMALL'],
    'XS': ['X-SMALL', 'X SMALL', 'XSMALL', 'EXTRA SMALL', '2S'],
    '2S': ['XS', 'SS', 'X-SMALL'],
    'XSMALL': ['XS'],
    'SS': ['XS'],
    'PS': ['S', 'XS'],
    'XS-S': ['XS', 'S', 'S/XS', 'XS/S', 'X-S'],
    'S-M': ['S', 'M', 'SMALL-MEDIUM', 'S/M'],
    'ML': ['M', 'L', 'M-L', 'M/L'],
    'LT': ['L'],
    '2LT': ['2L', 'LL', 'XL', '04(2LT)', '4(2LT)'],
    '3LT': ['3L', 'XXL', '2XL', '05(3L)', '5(3L)'],
    '4LT': ['4L', 'XXXL', '3XL'],
    'LL': ['XL', '2L', '2LT', 'LLT', 'LLXL'],
    'LLXL': ['LL', 'XL', '2L'],
    'XL': ['LL', '2L', 'LLXL', 'X-LARGE', 'X LARGE', 'XLARGE', 'EXTRA LARGE'],
    '2L': ['XL', 'LL'],
    'XXL': ['3L', '2XL', 'XX-LARGE', 'XX LARGE', 'XXLARGE', '2X-LARGE', '2X LARGE', '2XLARGE'],
    '2XL': ['XXL', '3L', 'XX-LARGE', 'XXLARGE'],
    '3L': ['XXL', '2XL'],
    'XXXL': ['4L', '3XL', 'XXX-LARGE', 'XXX LARGE', 'XXXLARGE', '3X-LARGE', '3X LARGE', '3XLARGE'],
    '3XL': ['XXXL', '4L', 'XXX-LARGE', 'XXXLARGE'],
    '4L': ['XXXL', '3XL'],
    'O': ['XL', 'LL', '2L'],
    'XO': ['XXL', '2XL', '3L'],
    '2XO': ['XXXL', '3XL', '4L'],
    '3XO': ['XXXXL', '4XL', '5L'],
    'FREE': ['F', 'フリー', 'ワンサイズ', 'ONESIZE', 'ONE SIZE'],
    'F': ['FREE', 'フリー', 'ワンサイズ', 'ONESIZE', 'ONE SIZE'],
    'フリー': ['FREE', 'F', 'ワンサイズ', 'ONESIZE', 'ONE SIZE'],
    'ワンサイズ': ['FREE', 'F', 'フリー', 'ONESIZE', 'ONE SIZE'],
    'ONESIZE': ['ONE SIZE', 'FREE', 'F', 'フリー', 'ワンサイズ'],
    'ONE SIZE': ['ONESIZE', 'FREE', 'F', 'フリー', 'ワンサイズ'],
    'ONE': ['ONESIZE', 'FREE', 'F', 'フリー', 'ワンサイズ']
  };

  function normalizeSizeSymbol(text) {
    var t = String(text == null ? '' : text);
    t = unescapeHtml(t);
    t = nfkc(t);
    t = t.trim();

    t = t.replace(/ゴウ/g, '号').replace(/ゴー/g, '号');

    var m;
    m = t.match(/^J\s*[\/／\-ー－]?\s*(XXS|XS|SS|S|M|L|LL|XL|XXL|XXXL|XXXXL|(?:[2-9]|1[0-9])L|(?:[2-9]|1[0-9])XL)$/i);
    if (m) t = m[1];

    m = t.match(/^(XXS|XS|SS|S|M|L|LL|XL|XXL|XXXL|XXXXL|(?:[2-9]|1[0-9])L|(?:[2-9]|1[0-9])XL)\s*[\(（]\s*\d{1,2}\s*号\s*[\)）]$/i);
    if (m) t = m[1];

    m = t.match(/^(\d{1,3})\s*[〈<]\s*[^〉>]{1,20}\s*[〉>]$/);
    if (m) t = m[1];

    m = t.match(/^(\d{1,2})月(\d{1,2})日$/);
    if (m) t = m[1] + '-' + m[2];

    m = t.match(/^(XXS|XS|SS|S|M|L|LL|XL|XXL|XXXL|XXXXL|(?:[2-9]|1[0-9])L|(?:[2-9]|1[0-9])XL|FREE|F|フリー|ワンサイズ|ONE\s*SIZE|ONESIZE|ONE)\s*[\/／]\s*\d{1,3}(?:\.\d+)?\s*[-~〜～ー－]\s*\d{1,3}(?:\.\d+)?\s*(?:cm|CM|センチ)?$/i);
    if (m) t = m[1];

    m = t.match(/^(\d{1,3}(?:\.\d+)?)\s*[-~〜～ー－]\s*(\d{1,3}(?:\.\d+)?)\s*(?:cm|CM|センチ)?$/i);
    if (m) {
      return formatNumber(parseFloat(m[1])) + '-' + formatNumber(parseFloat(m[2]));
    }

    t = t.replace(/※/g, '*').replace(/＊/g, '*');

    var parenAlt = 'XXS|XS|SS|MS|LS|PS|S|M|L|XL|XXL|XXXL|XXXXL|LL|(?:[2-9]|1[0-9])L|(?:[2-9]|1[0-9])LT|LT|LLT|ML|MT|ST|S-M|XS-S|S-XS|S/XS|XS/S|X-SMALL|X SMALL|XSMALL|EXTRA\\s*SMALL|XX-SMALL|XX SMALL|XXSMALL|2X-SMALL|2X SMALL|2XSMALL|X-LARGE|X LARGE|XLARGE|EXTRA\\s*LARGE|XX-LARGE|XX LARGE|XXLARGE|2X-LARGE|2X LARGE|2XLARGE|XXX-LARGE|XXX LARGE|XXXLARGE|3X-LARGE|3X LARGE|3XLARGE|FREE|F|フリー|ONE\\s*SIZE|ONESIZE|ONE|SMALL|MEDIUM|LARGE';
    m = t.match(new RegExp('[\\(（]\\s*(' + parenAlt + ')\\s*[\\)）]', 'i'));
    if (m) t = m[1];

    t = t.toUpperCase();
    t = t.replace(/サイズ/g, '');
    t = t.replace(/マタニティ/g, '');
    t = t.replace(/ﾏﾀﾆﾃｨ/g, '');
    t = t.replace(/ /g, '').replace(/　/g, '');
    t = t.replace(/\//g, '').replace(/／/g, '');
    t = t.replace(/-/g, '').replace(/_/g, '');
    t = t.replace(/INCH/g, 'インチ');
    t = t.replace(/ＣＭ/g, 'CM');
    t = t.replace(/CM/g, '');

    if (/^(フリー|ワンサイズ|FREE|FREESIZE|FREEサイズ)/i.test(t) || t.indexOf('ワン') === 0) t = 'FREE';
    if (t === 'FR') t = 'FREE';
    if (t === 'ONESIZE' || t === 'ONE SIZE' || t === 'ONE') t = 'ONESIZE';

    t = t.replace(/－/g, '-').replace(/ー/g, '-').replace(/〜/g, '~').replace(/～/g, '~');
    if (['SXS', 'S-XS', 'S/XS', 'XS/S'].indexOf(t) !== -1) t = 'XS-S';
    else if (['XSS', 'XS-S'].indexOf(t) !== -1) t = 'XS-S';
    else if (['SM', 'S-M'].indexOf(t) !== -1) t = 'S-M';
    else if (/^[2-9]LT$/.test(t)) { /* keep */ }
    else if (['LLT', 'LL-T'].indexOf(t) !== -1) t = '2LT';
    else if (['LLXL', 'LL-XL', 'LL/XL', 'XL/LL'].indexOf(t) !== -1) t = 'LLXL';

    if (['XXSMALL', 'XX-SMALL', '2XSMALL', '2X-SMALL', 'EXTRAEXTRASMALL'].indexOf(t) !== -1) t = 'XXS';
    else if (['XSMALL', 'X-SMALL', 'EXTRASMALL'].indexOf(t) !== -1) t = 'XS';
    else if (t === 'SMALL') t = 'S';
    else if (t === 'MEDIUM') t = 'M';
    else if (t === 'LARGE') t = 'L';
    else if (['XLARGE', 'X-LARGE', 'EXTRALARGE'].indexOf(t) !== -1) t = 'XL';
    else if (['XXLARGE', 'XX-LARGE', '2XLARGE', '2X-LARGE'].indexOf(t) !== -1) t = 'XXL';
    else if (['XXXLARGE', 'XXX-LARGE', '3XLARGE', '3X-LARGE'].indexOf(t) !== -1) t = 'XXXL';

    m = t.match(/^(\d+(?:\.\d+)?)インチ$/);
    if (m) t = m[1];

    if (/^\d+\.0$/.test(t)) t = t.slice(0, -2);

    t = t.replace(/^([A-Z0-9]+)号$/, '$1');

    return t.trim();
  }

  function getSizeAliases(sizeText) {
    var base = normalizeSizeSymbol(sizeText);
    var aliases = new Set([base]);
    var rawText = normalizeOneLine(sizeText);

    var kidsMatch = nfkc(rawText).match(/(?:KIDS|キッズ)\s*(XXS|XS|SS|S|M|L|LL|XL|XXL|XXXL|(?:[2-9]|1[0-9])L)/i);

    (ALIAS_MAP[base] || []).forEach(function (a) { aliases.add(normalizeSizeSymbol(a)); });

    if (kidsMatch) {
      var kb = normalizeSizeSymbol(kidsMatch[1]);
      aliases.add(kb);
      (ALIAS_MAP[kb] || []).forEach(function (a) { aliases.add(normalizeSizeSymbol(a)); });
    }

    var alphaToGou = { S: ['7号'], M: ['9号'], L: ['11号'], XL: ['13号'], LL: ['13号'], '2L': ['13号'], XXL: ['15号'], '2XL': ['15号'], '3L': ['15号'], XXXL: ['17号'], '3XL': ['17号'], '4L': ['17号'], XXXXL: ['19号'], '4XL': ['19号'], '5L': ['19号'] };
    (alphaToGou[base] || []).forEach(function (a) { aliases.add(a); });

    var gouToAlpha = { '7': ['S'], '9': ['M'], '11': ['L'], '13': ['XL', 'LL', '2L'], '15': ['XXL', '2XL', '3L'], '17': ['XXXL', '3XL', '4L'], '19': ['XXXXL', '4XL', '5L'] };
    if (/号/.test(rawText)) (gouToAlpha[base] || []).forEach(function (a) { aliases.add(a); });

    var trailingInv = rawText.match(/^(.+?)[\(（]\d{1,3}[\)）]$/);
    if (trailingInv) {
      var strippedInv = trailingInv[1].trim();
      if (/(?:cm|CM|号|インチ|XXS|XS|SS|S|M|L|LL|XL|XXL|XXXL|(?:[2-9]|1[0-9])L|FREE|フリー|ワンサイズ|ONE)/i.test(strippedInv)) {
        aliases.add(normalizeSizeSymbol(strippedInv));
      }
    }

    var leadingRange = rawText.match(/^\s*(XXS|XS|SS|S|M|L|LL|XL|XXL|XXXL|XXXXL|(?:[2-9]|1[0-9])L|(?:[2-9]|1[0-9])XL|FREE|F|フリー)?\s*[\(（]\s*(\d{1,3}(?:\.\d+)?\s*[-~〜～ー－]\s*\d{1,3}(?:\.\d+)?)\s*(?:cm|CM)?\s*[\)）](?:\s*[\(（]\d{1,3}[\)）])?\s*$/i);
    if (leadingRange) {
      if (leadingRange[1]) aliases.add(normalizeSizeSymbol(leadingRange[1]));
      var rangeMatch2 = normalizeOneLine(leadingRange[2]).match(/^(\d{1,3}(?:\.\d+)?)\s*[-~〜～ー－]\s*(\d{1,3}(?:\.\d+)?)$/);
      if (rangeMatch2) {
        var left = formatNumber(parseFloat(rangeMatch2[1])), right = formatNumber(parseFloat(rangeMatch2[2]));
        aliases.add(left + '-' + right); aliases.add(left + '~' + right);
        aliases.add(left + 'cm-' + right + 'cm'); aliases.add(left + 'cm~' + right + 'cm');
      }
    }

    var paren = normalizeOneLine(sizeText).match(/^(\d{1,3})\s*[\(（]([^\)）]+)[\)）]$/);
    if (paren) {
      aliases.add(normalizeSizeSymbol(paren[1]));
      var pinner = normalizeSizeSymbol(paren[2]);
      aliases.add(pinner);
      (ALIAS_MAP[pinner] || []).forEach(function (a) { aliases.add(normalizeSizeSymbol(a)); });
    }

    var angle = rawText.match(/^(\d{1,3})\s*[〈<]\s*([^〉>]{1,20})\s*[〉>]$/);
    if (angle) { aliases.add(normalizeSizeSymbol(angle[1])); aliases.add(normalizeSizeSymbol(angle[2])); }

    [rawText, base].forEach(function (src) {
      var rm = normalizeOneLine(src).match(/^(\d{1,3}(?:\.\d+)?)\s*[-~〜～ー－]\s*(\d{1,3}(?:\.\d+)?)$/);
      if (rm) {
        var cl = /^\d+(?:\.\d+)?$/.test(rm[1]) ? formatNumber(parseFloat(rm[1])) : rm[1];
        var cr = /^\d+(?:\.\d+)?$/.test(rm[2]) ? formatNumber(parseFloat(rm[2])) : rm[2];
        aliases.add(cl + '-' + cr); aliases.add(cl + '~' + cr);
        aliases.add(cl + 'cm-' + cr + 'cm'); aliases.add(cl + 'cm~' + cr + 'cm');
      }
    });

    var lt = base.match(/^([2-9])LT$/);
    if (lt) {
      var n = lt[1];
      aliases.add(n + 'L');
      if (n === '2') { aliases.add('LL'); aliases.add('XL'); aliases.add('2L'); }
      else if (n === '3') { aliases.add('3L'); aliases.add('XXL'); aliases.add('2XL'); }
      else if (n === '4') { aliases.add('4L'); aliases.add('XXXL'); aliases.add('3XL'); }
    }

    var mm = base.match(/^(\d+)$/);
    if (mm) aliases.add(mm[1] + '号');
    mm = base.match(/^(\d+)号$/);
    if (mm) aliases.add(mm[1]);
    mm = base.match(/^(\d+(?:\.\d+)?)CM$/);
    if (mm) aliases.add(mm[1]);
    mm = base.match(/^(\d+(?:\.\d+)?)インチ$/);
    if (mm) aliases.add(mm[1]);

    var rawHasCm = /cm|CM|センチ/.test(rawText);
    mm = base.match(/^(\d{2})(\d{2})$/);
    if (mm) {
      var l1 = parseInt(mm[1], 10), r1 = parseInt(mm[2], 10);
      if (l1 >= 26 && l1 <= 44 && r1 >= 26 && r1 <= 40) { aliases.add(mm[1]); aliases.add(mm[1] + 'インチ'); }
    }
    mm = base.match(/^(\d{2})[\-ー－](\d{2})$/);
    if (mm && !rawHasCm) {
      var l2 = parseInt(mm[1], 10), r2 = parseInt(mm[2], 10);
      if (l2 >= 26 && l2 <= 44 && r2 >= 26 && r2 <= 40) { aliases.add(mm[1]); aliases.add(mm[1] + 'インチ'); }
    }

    var rawUpper = nfkc(rawText).toUpperCase();
    var compositeAlias = rawText.match(/^(XXS|XS|SS|S|M|L|LL|XL|XXL|XXXL|XXXXL|(?:[2-9]|1[0-9])L|(?:[2-9]|1[0-9])XL|FREE|F|フリー|ワンサイズ|ONE\s*SIZE|ONESIZE|ONE)\s*[\/／]\s*(\d{1,3}(?:\.\d+)?)\s*[-~〜～ー－]\s*(\d{1,3}(?:\.\d+)?)\s*(?:cm|CM|センチ)?$/i);
    if (compositeAlias) {
      var head = normalizeSizeSymbol(compositeAlias[1]);
      var cleft = formatNumber(parseFloat(compositeAlias[2])), cright = formatNumber(parseFloat(compositeAlias[3]));
      aliases.add(head);
      (ALIAS_MAP[head] || []).forEach(function (a) { aliases.add(normalizeSizeSymbol(a)); });
      aliases.add(cleft + '-' + cright); aliases.add(cleft + '~' + cright);
      aliases.add(cleft + 'cm-' + cright + 'cm'); aliases.add(cleft + 'cm~' + cright + 'cm');
    }

    var braShortSuffix = rawUpper.match(/^[A-Z]{1,2}\d{2,3}\s*[\/／]?\s*([ML])$/);
    if (braShortSuffix) aliases.add(braShortSuffix[1]);

    var dashCorr = rawText.match(/^(\d{2})\s*[-ー－]\s*(\d{1,2}(?:\.\d+)?)\s*(?:cm|CM)?$/);
    if (dashCorr) {
      var leftCode = parseInt(dashCorr[1], 10), rightCm = parseFloat(dashCorr[2]);
      if (leftCode >= 30 && leftCode <= 50 && rightCm >= 18 && rightCm <= 32) aliases.add(dashCorr[1]);
    }

    var parenCm = rawText.match(/^(\d{1,3}(?:\.\d+)?)\s*(?:cm|CM)?\s*[\(（]\s*([^\)）]{1,20})\s*[\)）]$/);
    if (parenCm) {
      aliases.add(normalizeSizeSymbol(parenCm[1]));
      aliases.add(normalizeSizeSymbol(parenCm[1] + 'cm'));
      aliases.add(normalizeSizeSymbol(parenCm[2]));
    }

    var parenInner = rawText.match(/^([^()（）]{1,20})[\(（]\s*([^()（）]{1,20})\s*[\)）]$/);
    if (parenInner) {
      var inner = normalizeOneLine(parenInner[2]);
      var innerNorm = normalizeSizeSymbol(inner);
      if (innerNorm) {
        aliases.add(innerNorm);
        if (/^\d{2,3}(?:\.\d+)?$/.test(innerNorm)) aliases.add(innerNorm + 'cm');
      }
      if (/^[A-I]\d{2,3}$/i.test(innerNorm)) aliases.add(innerNorm.toUpperCase());
    }

    var leadingSize = rawUpper.match(/^\s*(XXS|XS|SS|MS|LS|PS|S|M|L|XL|XXL|XXXL|XXXXL|LL|(?:[2-9]|1[0-9])L|(?:[2-9]|1[0-9])XL|(?:[2-9]|1[0-9])LT|LT|LLT|ML|MT|ST|S-M|XS-S|S-XS|S\/XS|XS\/S|FREE|F|ONE\s*SIZE|ONESIZE|ONE|SMALL|MEDIUM|LARGE|X-SMALL|X SMALL|XSMALL|EXTRA\s*SMALL|X-LARGE|X LARGE|XLARGE|EXTRA\s*LARGE|XX-LARGE|XX LARGE|XXLARGE|2X-LARGE|2X LARGE|2XLARGE|XXX-LARGE|XXX LARGE|XXXLARGE|3X-LARGE|3X LARGE|3XLARGE)\s*[\(（]/i);
    if (leadingSize) {
      var lead = normalizeSizeSymbol(leadingSize[1]);
      aliases.add(lead);
      (ALIAS_MAP[lead] || []).forEach(function (a) { aliases.add(normalizeSizeSymbol(a)); });
    }

    var numericBase = base.match(/^0*(\d{1,3})$/);
    if (numericBase) {
      var number = String(parseInt(numericBase[1], 10));
      aliases.add(number); aliases.add(number.padStart(2, '0'));
      aliases.add(number + '号'); aliases.add(number.padStart(2, '0') + '号');
      aliases.add(number + 'インチ'); aliases.add(number.padStart(2, '0') + 'インチ');
    }

    var xlCount = base.match(/^((?:[2-9]|1[0-9]))XL$/);
    if (xlCount) {
      var xn = parseInt(xlCount[1], 10);
      if (xn === 2) { aliases.add('XXL'); aliases.add('3L'); }
      else if (xn === 3) { aliases.add('XXXL'); aliases.add('4L'); }
      else if (xn === 4) { aliases.add('XXXXL'); aliases.add('5L'); }
      else aliases.add(String(xn + 1) + 'L');
    }

    var largeLCount = base.match(/^((?:[6-9]|1[0-9]))L$/);
    if (largeLCount) aliases.add(String(parseInt(largeLCount[1], 10) - 1) + 'XL');

    if (base === 'XXXXL') { aliases.add('4XL'); aliases.add('5L'); }
    if (base === '5L') { aliases.add('XXXXL'); aliases.add('4XL'); }

    var prefixedSuit = rawUpper.match(/^[SLB]?(\d{2})[\(（]((?:Y|YA|A|AB|B|BB|BE)\d{1,2})[\)）]$/);
    if (prefixedSuit) aliases.add(normalizeSizeSymbol(prefixedSuit[2]));

    var out = new Set();
    aliases.forEach(function (a) { if (a) out.add(a); });
    return out;
  }

  function setHasIntersection(a, b) {
    for (var it = a.values(), v; !(v = it.next()).done;) if (b.has(v.value)) return true;
    return false;
  }

  // ========================================================================
  // ノイズ判定・共通判定系
  // ========================================================================

  var EXACT_KNOWN_SIZE_CHOICES = new Set([
    'XXS', 'XS', 'SS', 'S', 'M', 'L', 'LL', 'XL', 'XXL', 'XXXL', 'XXXXL',
    '2L', '3L', '4L', '5L', '2XL', '3XL', '4XL', '5XL', 'FREE', 'F', 'フリー', 'ワンサイズ', 'ONESIZE', 'ONE SIZE'
  ]);

  function isExactKnownSizeChoiceForVariation(text) {
    var norm = normalizeSizeSymbol(text);
    if (!norm) return false;
    return EXACT_KNOWN_SIZE_CHOICES.has(norm);
  }

  var COLOR_WORDS_RE = /(BLACK|WHITE|GRAY|GREY|BROWN|BLUE|NAVY|MOCHA|SAX|BEIGE|IVORY|RED|GREEN|PINK|PURPLE|LILAC|YELLOW|ORANGE|KHAKI|OLIVE|WINE|MIX|MULTI|BORDER|CHECK|マルチ|グレー|ブルー|ブラック|ホワイト|ブラウン|モカ|サックス|ネイビー|レッド|グリーン|ピンク|パープル|イエロー|オレンジ|カーキ|オリーブ|ワイン)/i;
  var COLOR_WORDS_RE_NARROW = /(BLACK|WHITE|GRAY|GREY|BROWN|BLUE|NAVY|MOCHA|SAX|BEIGE|IVORY|RED|GREEN|PINK|PURPLE|LILAC|MIX|MULTI|マルチ|グレー|ブルー|ブラック|ホワイト|ブラウン|モカ|サックス|ネイビー)/i;

  function isLikelySizeVariationValue(value) {
    var raw = normalizeOneLine(value);
    if (!raw) return false;
    var rawUpperFull = nfkc(raw).toUpperCase();

    var rawWithoutAllowedFull = rawUpperFull;
    ['サイズ', '号', 'インチ', 'フリー', 'ワンサイズ', 'ワン'].forEach(function (a) {
      rawWithoutAllowedFull = rawWithoutAllowedFull.split(a.toUpperCase()).join('').split(a).join('');
    });
    if (/[ぁ-んァ-ヶ一-龥]/.test(rawWithoutAllowedFull)) return false;
    if (COLOR_WORDS_RE.test(rawUpperFull)) return false;

    var rawUpper = rawUpperFull;
    var firstSize = rawUpper.match(/^\s*(XXXXL|XXXL|XXL|XL|XS|XXS|SS|S|M|L|LL|(?:[2-9]|1[0-9])L|(?:[2-9]|1[0-9])LT|LT|LLT|\d{1,2}H|FREE|F|フリー|ワンサイズ|ONE\s*SIZE|ONESIZE|ONE|X[-\s]?SMALL|EXTRA\s*SMALL|XX[-\s]?SMALL|2X[-\s]?SMALL|X[-\s]?LARGE|EXTRA\s*LARGE|XX[-\s]?LARGE|2X[-\s]?LARGE|XXX[-\s]?LARGE|3X[-\s]?LARGE|\d{1,3}(?:\.\d+)?(?:号|インチ|INCH|inch|cm|CM)?|\d{1,3}[\(（][^\)）]+[\)）])(?=\s|$|\/|／|:|：|\(|（)/i);
    if (firstSize) rawUpper = firstSize[1];

    var rawWithoutAllowed = rawUpper;
    ['サイズ', '号', 'インチ', 'フリー'].forEach(function (a) {
      rawWithoutAllowed = rawWithoutAllowed.split(a.toUpperCase()).join('').split(a).join('');
    });
    if (/[ぁ-んァ-ヶ一-龥]/.test(rawWithoutAllowed)) return false;
    if (COLOR_WORDS_RE_NARROW.test(rawUpper)) return false;

    var normalized = normalizeSizeSymbol(rawUpper);
    if (!normalized) return false;

    if (/^(XXS|XS|SS|S|M|L|LL|XL|XXL|XXXL|XXXXL|(?:[2-9]|1[0-9])L|(?:[2-9]|1[0-9])LT|LT|LLT|\d{1,2}H|\d{1,2}S|BM|BL|PS|XS-S|S-M|ML|FREE|F|ONESIZE|ONE)$/i.test(normalized)) return true;
    if (/^\d{1,3}(?:\.\d+)?(?:号|インチ)?$/i.test(normalized)) return true;
    if (/^\d{1,3}[\(（]?[A-Z0-9\-\/]+[\)）]?$/i.test(normalized)) return true;
    return false;
  }

  function isNoiseDimensionKey(sizeSymbol) {
    var key = normalizeOneLine(sizeSymbol);
    if (!key) return true;
    if (key === '__SINGLE__') return true;
    if (['サイズ', 'SIZE', '実寸', '実寸サイズ', '商品サイズ'].indexOf(key) !== -1) return true;
    if (/(型番|品番|商品番号|素材|仕様|商品説明|商品の説明|カラーバリエーション|注意|注意点|商品特性|部分使|リブ部分|本体|表地|裏地|中わた|中綿|フード裏|別布|中国製|日本製|膝裏|注意事項|取り扱い|返品について|スタッフ着用コメント|モデル着用サイズ|ご使用上の注意|機能|デザイン|商品サイズ|小さいサイズ|おすすめ|スタイリング|アジャスター|ポケット|透け感|生地の厚さ|伸縮性|ポイント|関連特集|Styling Point|Color|アイテム|サイズ詳細|サイズ情報|商品について|お買い物をより楽しんで頂くために|推奨サイズ|対象|柄について|プリント生地|柄生地)/.test(key)) return true;
    if (/^0\d{2,}$/.test(normalizeSizeSymbol(key))) return true;
    if (['KIDS', 'KID'].indexOf(normalizeSizeSymbol(key)) !== -1) return true;
    if (key.indexOf(':') !== -1 || key.indexOf('：') !== -1) return true;
    return false;
  }

  function isCommonSingleDimensionText(dimensionText) {
    var text = normalizeOneLine(dimensionText);
    var risky = ['着丈', '身丈', '身幅', '肩幅', '肩巾', '袖丈', '袖幅', '袖巾', '袖口', '裄丈', 'ゆき丈', 'ウエスト', 'ヒップ', '股上', '股下', '総丈', 'バスト', '胸囲', 'スカート丈', 'パンツ丈', 'もも周り', 'わたり', 'ワタリ'];
    if (risky.some(function (w) { return text.indexOf(w) !== -1; })) return false;
    var common = ['ヒール', 'ソール', '筒丈', '筒周り', '高さ', '縦', '横', '幅', '横幅', '横巾', 'まち', 'マチ', '持ち手', '持手', '親骨', '頭囲', '頭周り', 'つば', 'ツバ', '直径', '長さ', 'トップ', 'ポスト長', 'サイズ', '全長', '太さ', 'コード', 'コード部分', 'メタルパーツ', '頭口巾置き寸', '頭口巾', '頭口幅', 'ケース縦', 'ケース横', 'ケース厚', 'ベルト最大', 'リング内径', '金具内径', '内径', '厚さ'];
    return common.some(function (w) { return text.indexOf(w) !== -1; });
  }

  function isStandardAlphaSizeKey(sizeSymbol) {
    var n = normalizeSizeSymbol(sizeSymbol);
    return ['XXS', 'XS', 'SS', 'S', 'M', 'L', 'LL', 'XL', 'XXL', 'XXXL', 'XXXXL', '2L', '3L', '4L', '5L', 'FREE', 'F', 'ONESIZE', 'ONE', 'PS', 'XS-S', 'S-M', 'ML'].indexOf(n) !== -1;
  }

  function isNumericSizeKey(sizeSymbol) {
    return /^\d{1,3}(?:\.\d+)?$/.test(normalizeSizeSymbol(sizeSymbol));
  }

  // ========================================================================
  // 寸法テキスト構築 (build_dimension_text 系)
  // ========================================================================

  function preferPrimaryBodyParts(parts) {
    if (!parts || !parts.length) return parts;
    var normalized = parts.map(function (p) { return [cleanDimensionLabel(p[0]), p[1]]; });
    var labels = normalized.map(function (p) { return p[0]; });
    function hasWord(word) { return labels.some(function (l) { return l.indexOf(word) !== -1; }); }
    function filterInclude(word) { return normalized.filter(function (p) { return p[0].indexOf(word) !== -1; }); }
    function filterExclude(words) { return normalized.filter(function (p) { return !words.some(function (w) { return p[0].indexOf(w) !== -1; }); }); }

    if (hasWord('本体') && !['スティック', '台座', 'ケース', 'パッケージ'].some(hasWord)) {
      var bodyParts = filterInclude('本体');
      if (bodyParts.length) return bodyParts;
    }
    var secondaryWords = ['ライナー', 'インナー', 'キャミ'];
    if (secondaryWords.some(hasWord)) {
      var primaryLike = filterExclude(secondaryWords);
      if (primaryLike.length) return primaryLike;
    }
    var priorityPairs = [['ブルゾン', 'ライナー'], ['アウター', 'インナー'], ['ニット', 'キャミ'], ['Tシャツ', 'キャミ'], ['トップス', 'キャミ']];
    for (var i = 0; i < priorityPairs.length; i++) {
      var pw = priorityPairs[i][0], sw = priorityPairs[i][1];
      if (hasWord(pw) && hasWord(sw)) {
        var pp = filterInclude(pw);
        if (pp.length) return pp;
      }
    }
    return normalized;
  }

  var GOODS_LABELS_FOR_MM = new Set(['W', 'H', 'D', '幅', '横', '横幅', '高さ', '縦', '奥行', '奥行き', 'マチ', 'まち', '上部幅', '下部幅', '本体幅', '本体高さ', '本体奥行', '本体奥行き', 'ケース横', 'ケース縦', 'ケース高さ', 'ケースマチ']);

  function shouldForceUnmarkedGoodsDimensionsToMm(parts) {
    if (!parts || !parts.length) return false;
    var sawGoodsLabel = false, maxNoUnit = 0;
    parts.forEach(function (p) {
      var cleanLabel = cleanDimensionLabel(p[0]);
      var rawValue = normalizeOneLine(p[1]);
      if (/cm|CM|センチ|mm|MM|ミリ/.test(rawValue)) return;
      if (!GOODS_LABELS_FOR_MM.has(cleanLabel)) return;
      var number = extractMaxNumber(rawValue);
      if (!number) return;
      var numeric = parseFloat(number);
      if (isNaN(numeric)) return;
      sawGoodsLabel = true;
      maxNoUnit = Math.max(maxNoUnit, numeric);
    });
    return sawGoodsLabel && maxNoUnit >= 250;
  }

  var BODY_CONTEXT_LABELS = new Set(['バスト', '胸囲', 'チェスト', '胸回り', 'トップバスト', 'アンダーバスト', 'ウエスト', 'ウェスト', 'ヒップ', '着丈', '身丈', '肩幅', '身幅', '袖丈', '裄丈', 'ゆき丈', '総丈', '股上', '股下', 'わたり', 'ワタリ', '裾幅', 'スカート丈', 'パンツ丈']);

  function shouldConvertBLabelToBust(parts) {
    var labels = new Set((parts || []).map(function (p) { return cleanDimensionLabel(p[0]); }));
    var hit = false;
    labels.forEach(function (l) { if (BODY_CONTEXT_LABELS.has(l)) hit = true; });
    if (hit) return true;
    if (labels.has('B') && (labels.has('ウエスト') || labels.has('ウェスト') || labels.has('ヒップ'))) return true;
    return false;
  }

  function normalizeDimensionValueAndUnitForOutput(label, value, rawValue, unit) {
    label = cleanDimensionLabel(label);
    rawValue = normalizeOneLine(rawValue);
    var numericValue = parseFloat(value);
    if (isNaN(numericValue)) return [value, unit];

    if (unit === 'cm' && numericValue > 300) {
      var compact = rawValue.replace(/[^0-9]/g, '');
      if (compact.length % 2 === 0 && compact.length >= 4) {
        var half = compact.length / 2;
        var left = compact.slice(0, half), right = compact.slice(half);
        if (left === right) {
          var lf = parseFloat(left);
          if (!isNaN(lf)) return [formatNumber(lf), 'cm'];
        }
      }
      if (numericValue > 999 && numericValue <= 9999 && !/cm|CM|センチ/.test(rawValue)) {
        return [formatNumber(numericValue), 'mm'];
      }
    }
    return [value, unit];
  }

  function buildDimensionTextRaw(parts) {
    parts = preferPrimaryBodyParts(parts);
    var output = [];
    var forceMm = shouldForceUnmarkedGoodsDimensionsToMm(parts);
    var convertB = shouldConvertBLabelToBust(parts);

    parts.forEach(function (p) {
      var label = cleanDimensionLabel(p[0]);
      var rawValue = normalizeOneLine(p[1]);
      var unit;
      if (/mm|MM|ミリ/.test(rawValue)) unit = 'mm';
      else if (forceMm && !/cm|CM|センチ/.test(rawValue)) unit = 'mm';
      else unit = 'cm';

      var value = extractMaxNumber(rawValue);
      var res = normalizeDimensionValueAndUnitForOutput(label, value, rawValue, unit);
      value = res[0]; unit = res[1];

      if (!label || !value) return;
      if (['コード', 'CODE'].indexOf(cleanDimensionLabel(label)) !== -1) return;
      var fv = parseFloat(value);
      if (!isNaN(fv) && fv === 0) return;

      if (label.toUpperCase() === 'B') {
        var fvb = parseFloat(value);
        if (unit !== 'cm' || (!isNaN(fvb) && fvb > 180)) return;
        if (convertB) label = 'バスト';
      }
      output.push(label + value + unit);
    });
    return output.join(' ');
  }

  function buildDimensionText(parts) {
    var text = buildDimensionTextRaw(parts);
    return normalizeDimensionTextForRakuten(text);
  }

  function buildDimensionTextNormalized(parts) {
    var normalized = (parts || []).map(function (p) { return [normalizeOutputLabel(p[0]), p[1]]; });
    return buildDimensionText(normalized);
  }

  function collapseDimensionRangesToMaxText(dimensionText) {
    var text = normalizeOneLine(dimensionText);
    if (!text) return '';
    var sep = RANGE_SEP_CLASS;
    var labelPattern = '([^\\s\\d~〜～\\-－−ー―‐–—?]+?)';

    text = text.replace(new RegExp(labelPattern + '(\\d+(?:\\.\\d+)?)\\s*(cm|mm)\\s*' + sep + '\\s*(\\d+(?:\\.\\d+)?)\\s*(cm|mm)?', 'gi'),
      function (m, label, left, unit1, right, unit2) {
        unit1 = unit1.toLowerCase(); unit2 = (unit2 || unit1).toLowerCase();
        var maxV;
        try { maxV = formatNumber(Math.max(parseFloat(left), parseFloat(right))); }
        catch (e) { maxV = extractMaxNumber(left + '~' + right); }
        return label + maxV + unit2;
      });

    text = text.replace(new RegExp(labelPattern + '(\\d+(?:\\.\\d+)?)\\s*(cm|mm)\\s*' + sep + '(?=\\s|$)', 'gi'),
      function (m, label, value, unit) { return label + formatNumber(parseFloat(value)) + unit.toLowerCase(); });

    text = text.replace(new RegExp(labelPattern + '(\\d+(?:\\.\\d+)?)\\s*' + sep + '\\s*(\\d+(?:\\.\\d+)?)\\s*(cm|mm)', 'gi'),
      function (m, label, left, right, unit) {
        unit = unit.toLowerCase();
        var maxV;
        try { maxV = formatNumber(Math.max(parseFloat(left), parseFloat(right))); }
        catch (e) { maxV = extractMaxNumber(left + '~' + right); }
        return label + maxV + unit;
      });

    return text;
  }

  function cleanRedundantDimensionText(dimensionText) {
    // 元Python: 同一ラベルが複数回出た場合、最大値だけを残す簡易正規化。
    var text = normalizeOneLine(dimensionText);
    if (!text) return '';
    var tokens = text.split(' ').filter(Boolean);
    var seen = {};
    var order = [];
    tokens.forEach(function (token) {
      var m = token.match(/^([^\d]+)(\d+(?:\.\d+)?)(cm|mm)$/i);
      if (!m) { if (order.indexOf(token) === -1) order.push(token); return; }
      var label = m[1], value = parseFloat(m[2]), unit = m[3].toLowerCase();
      if (!seen.hasOwnProperty(label)) { seen[label] = { value: value, unit: unit }; order.push(label); }
      else {
        var mm = (u) => u === 'mm' ? 1 : 10;
        if (value * mm(unit) > seen[label].value * mm(seen[label].unit)) seen[label] = { value: value, unit: unit };
      }
    });
    return order.map(function (item) {
      if (seen.hasOwnProperty(item)) return item + formatNumber(seen[item].value) + seen[item].unit;
      return item;
    }).join(' ');
  }

  // ========================================================================
  // 楽天属性ラベル正規化 (v111 の主要部分のみ: バスト⇔身幅の表記統一)
  // ========================================================================

  function splitDimensionToken(token) {
    var m = normalizeOneLine(token).match(/^([^\d]+)(\d+(?:\.\d+)?)(cm|mm)$/i);
    if (!m) return null;
    return [m[1], m[2], m[3].toLowerCase()];
  }

  function normalizeRakutenDimensionLabel(label) {
    label = cleanDimensionLabel(label);
    var map = { 'ウェスト': 'ウエスト', '身巾': '身幅', '肩巾': '肩幅', '裾巾': '裾幅', '袖巾': '袖幅', '胸巾': '胸幅' };
    return map.hasOwnProperty(label) ? map[label] : label;
  }

  function normalizeDimensionTextForRakuten(dimensionText) {
    // 簡略版: 元v111は許可属性リスト分岐を含むが、ここでは表記ゆれの統一だけを行う
    // （出力属性の付け替え自体はbuildRakutenOutputDimensionMap/バスト判定側で行う）。
    var text = normalizeOneLine(dimensionText);
    if (!text) return '';
    var tokens = text.split(' ').filter(Boolean);
    var out = tokens.map(function (token) {
      var parsed = splitDimensionToken(token);
      if (!parsed) return token;
      var label = normalizeRakutenDimensionLabel(parsed[0]);
      return label + parsed[1] + parsed[2];
    });
    return out.join(' ');
  }

  // ========================================================================
  // ラベル・値ペア抽出 (extract_label_value_pairs)
  // ========================================================================

  var COMPONENT_WORDS = ['本体', 'ライナー', 'アウター', 'インナー', 'ニット', 'Tシャツ', 'キャミ', 'トップス', 'ボトム', 'ブルゾン', 'シャツ', 'スカート', 'カーディガン', 'プルオーバー', 'カットソー'];
  var COMPONENT_ALT = COMPONENT_WORDS.map(escapeRe).join('|');

  function isFootWidthWidthCodeContext(label, blockText, start, end) {
    var cleanLabel = cleanDimensionLabel(label);
    if (cleanLabel !== '足幅' && cleanLabel !== '甲幅') return false;
    var around = normalizeOneLine(blockText.slice(Math.max(0, start - 25), Math.min(blockText.length, end + 35)));
    return /(?:足幅|甲幅|ウィズ|ウイズ|ワイズ|WIDTH).{0,25}\d+(?:\.\d+)?\s*[EeＥｅ]\s*(?:相当|向け)?/i.test(around);
  }

  function extractLabelValuePairs(blockTextIn) {
    var blockText = normalizeOneLine(blockTextIn);

    var braLikeMatches = blockText.match(/(?<![A-Z0-9])[A-H]\s*\d{2,3}(?![A-Z0-9])/gi) || [];
    if (braLikeMatches.length >= 3 && !/トップバスト|アンダーバスト|ヒップ|ウエスト|着丈|身幅|肩幅|袖丈|股上|股下|総丈/.test(blockText)) {
      return [];
    }

    blockText = blockText.replace(/袖\(二の腕\)幅/g, '二の腕幅').replace(/袖（二の腕）幅/g, '二の腕幅');
    blockText = blockText.replace(/Ｔシャツ/g, 'Tシャツ').replace(/Tｼｬﾂ/g, 'Tシャツ').replace(/Ｔｼｬﾂ/g, 'Tシャツ');
    blockText = blockText.replace(/ｷｬﾐｿｰﾙ/g, 'キャミ').replace(/キャミソール/g, 'キャミ');
    blockText = blockText.replace(/幅\s*[\(（]\s*上部\s*[\)）]/g, '上部幅');
    blockText = blockText.replace(/幅\s*[\(（]\s*下部\s*[\)）]/g, '下部幅');
    blockText = blockText.replace(/ショルダー\s*対応\s*サイズ/g, 'ショルダー対応サイズ');
    blockText = blockText.replace(/ショルダー\s*長さ\s*[\(（]\s*最短\s*[\)）]/g, 'ショルダー最短');
    blockText = blockText.replace(/ショルダー\s*長さ\s*[\(（]\s*最長\s*[\)）]/g, 'ショルダー最長');
    blockText = blockText.replace(/紐\s*部分\s*長さ/g, '紐部分長さ');
    blockText = blockText.replace(/踵\s*から\s*の\s*高さ/g, '踵からの高さ');
    blockText = blockText.replace(/かかと\s*から\s*の\s*高さ/g, 'かかとからの高さ');

    blockText = blockText.replace(
      new RegExp('(' + DIMENSION_LABEL_RE_SRC + ')\\s*[:：]\\s*最短\\s*約?(\\d+(?:\\.\\d+)?)\\s*(?:cm|CM)?\\s*[／/]\\s*最長\\s*約?(\\d+(?:\\.\\d+)?)\\s*(?:cm|CM)?', 'gi'),
      function (m, label, v1, v2) { return label + ':' + v1 + '-' + v2 + 'cm'; }
    );

    var apparelContext = /着丈|身丈|バスト|胸囲|B\s*[:：]|裄丈|ゆき丈|肩幅|身幅|袖丈|そで丈|ウエスト|ヒップ|股上|股下|総丈|スカート丈|パンツ丈/i.test(blockText);
    if (apparelContext) {
      blockText = blockText.replace(/(?<![A-Za-z])W\s*[:：]/gi, 'ウエスト:');
      blockText = blockText.replace(/(?<![A-Za-z])H\s*[:：]/gi, 'ヒップ:');
      blockText = blockText.replace(/(?<![A-Za-z])D\s*[:：]/gi, 'マチ:');
    } else {
      blockText = blockText.replace(/(?<![A-Za-z])H\s*[:：]/gi, '高さ:');
      blockText = blockText.replace(/(?<![A-Za-z])W\s*[:：]/gi, '横:');
      blockText = blockText.replace(/(?<![A-Za-z])D\s*[:：]/gi, 'マチ:');
    }

    var parts = [];

    var mainPattern = new RegExp(
      '(?<label_prefix>(?:' + COMPONENT_ALT + ')?)' +
      '(?<label>' + DIMENSION_LABEL_RE_SRC + ')' +
      '(?<label_extra>(?:' + COMPONENT_ALT + ')?)' +
      '(?:\\([^)]*\\))?' +
      '\\s*(?:[:：/／…・]|\\.{2,})?\\s*' +
      '(?:約|最長|最短)?\\s*[~〜～]?\\s*' +
      '(?<value>\\d+(?:\\.\\d+)?(?:\\s*[~〜～?\\-－]\\s*\\d+(?:\\.\\d+)?)?)' +
      '\\s*(?<unit>CM|cm|mm|MM|センチ|ミリ)?',
      'gi'
    );

    var m;
    while ((m = mainPattern.exec(blockText))) {
      var prefix = m.groups.label_prefix || '';
      var label = m.groups.label;
      var extra = m.groups.label_extra || '';
      var value = m.groups.value;
      var unit = m.groups.unit || '';
      if (unit) value = value + unit;

      if (isFootWidthWidthCodeContext(label, blockText, m.index, m.index + m[0].length)) continue;

      if (label.toUpperCase() === 'B') {
        var prevChar = m.index > 0 ? blockText[m.index - 1] : '';
        if (/[A-Za-z0-9]/.test(prevChar)) continue;
      }

      var around = normalizeOneLine(blockText.slice(Math.max(0, m.index - 35), m.index + m[0].length + 35));
      if (label.toUpperCase() === 'B' && /取り扱いサイズ|取扱いサイズ|サイズ展開/.test(around)) continue;
      if ((label.indexOf('コード') !== -1 || label.toUpperCase().indexOf('CODE') !== -1) &&
        /管理コード|メーカー管理コード|型番|品番|商品番号|JAN|SKU|CODE/i.test(around)) continue;

      parts.push([prefix + label + extra, value]);
      if (m[0].length === 0) mainPattern.lastIndex++;
    }

    var componentPattern = new RegExp(
      '(?<label>' + DIMENSION_LABEL_RE_SRC + ')' +
      '\\s*[:：]\\s*' +
      '(?<component>' + COMPONENT_ALT + ')?' +
      '\\s*' +
      '(?<value>\\d+(?:\\.\\d+)?(?:\\s*[~〜～?\\-－]\\s*\\d+(?:\\.\\d+)?)?)' +
      '\\s*(?<unit>CM|cm|mm|MM|センチ|ミリ)?',
      'gi'
    );
    while ((m = componentPattern.exec(blockText))) {
      var label2 = m.groups.label;
      var component = m.groups.component || '';
      var value2 = m.groups.value;
      var unit2 = m.groups.unit || '';
      if (unit2) value2 = value2 + unit2;

      if (label2.toUpperCase() === 'B') {
        var prevChar2 = m.index > 0 ? blockText[m.index - 1] : '';
        if (/[A-Za-z0-9]/.test(prevChar2)) continue;
        var around2 = normalizeOneLine(blockText.slice(Math.max(0, m.index - 35), m.index + m[0].length + 35));
        if (/取り扱いサイズ|取扱いサイズ|サイズ展開/.test(around2)) continue;
      }
      parts.push([label2 + component, value2]);
      if (m[0].length === 0) componentPattern.lastIndex++;
    }

    if (reDIM('i').test(blockText)) {
      var extraValuePattern = new RegExp(
        '(?<component>' + COMPONENT_ALT + ')' +
        '\\s*[:：]?\\s*(?<value>\\d+(?:\\.\\d+)?)' +
        '\\s*(?<unit>CM|cm|mm|MM|センチ|ミリ)?',
        'gi'
      );
      var lastLabel = '';
      var tokens = blockText.split(/\s+/);
      tokens.forEach(function (token) {
        var labelMatch = token.match(reDIM('i'));
        if (labelMatch) {
          lastLabel = labelMatch[0];
          COMPONENT_WORDS.forEach(function (cw) { lastLabel = lastLabel.split(cw).join(''); });
        }
        var em;
        extraValuePattern.lastIndex = 0;
        while ((em = extraValuePattern.exec(token))) {
          if (lastLabel) {
            var v3 = em.groups.value;
            var u3 = em.groups.unit || '';
            if (u3) v3 = v3 + u3;
            parts.push([lastLabel + em.groups.component, v3]);
          }
          if (em[0].length === 0) extraValuePattern.lastIndex++;
        }
      });
    }

    var deduped = [];
    var seen = new Set();
    parts.forEach(function (p) {
      var key = p[0] + '\u0001' + p[1];
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(p);
    });
    return deduped;
  }

  function cutNoiseAfterBlock(blockTextIn) {
    var blockText = normalizeText(blockTextIn);
    var cutPatterns = [
      /\n\s*【カラーバリエーション】/, /\n\s*素材/, /\n\s*中国製/, /\n\s*日本製/,
      /\n\s*原産国/, /\n\s*注意事項/, /\n\s*商品説明/, /\n\s*モデルサイズ/,
      /\n\s*モデル身長/, /\n\s*MODEL\s*[:：]/i, /\n\s*MODEL/i, /\n\s*洗濯方法/
    ];
    var earliest = -1;
    cutPatterns.forEach(function (re) {
      var m = blockText.match(re);
      if (m && (earliest === -1 || m.index < earliest)) earliest = m.index;
    });
    if (earliest !== -1) return blockText.slice(0, earliest);
    return blockText;
  }

  function hasEarlyDimensionLabel(blockText, limit) {
    limit = limit || 90;
    var early = normalizeOneLine(blockText.slice(0, limit));
    return reDIM('i').test(early);
  }

  function isImmediateModelSizeContext(text, start, end, window) {
    window = window || 35;
    var before = normalizeOneLine(text.slice(Math.max(0, start - window), start));
    var after = normalizeOneLine(text.slice(end, Math.min(text.length, end + 20)));
    var near = before + ' ' + after;
    if (/(モデル着用サイズ|着用サイズ|MODEL\s*size|MODEL SIZE|モデルサイズ)\s*[:：]?\s*$/i.test(before)) return true;
    if (/^\s*(?:\(|（)?\s*(?:身長|体重|B\d|W\d|H\d)/i.test(after)) return true;
    return false;
  }

  // ========================================================================
  // 抽出パターン: インライン コロン/スラッシュ形式
  // 例: M:バスト/92CM ウエスト/79CM 着丈/140CM
  // ========================================================================

  function extractFromInlineColonOrSlash(htmlText) {
    var result = {};
    var text = htmlToText(htmlText);

    var startPattern = new RegExp(
      '(?<![A-Za-z0-9])(?<size>' + SIZE_SYMBOL_RE_SRC + '(?:\\s*[\\(（]\\s*' + SIZE_SYMBOL_RE_SRC + '\\s*[\\)）])?)\\s*[:：/／・]',
      'gi'
    );

    var rawMatches = [];
    var m;
    while ((m = startPattern.exec(text))) {
      rawMatches.push({ match: m, start: m.index, end: m.index + m[0].length, size: m.groups.size });
      if (m[0].length === 0) startPattern.lastIndex++;
    }

    var matches = [];
    rawMatches.forEach(function (rm) {
      var sizeSymbol = rm.size;
      if (isImmediateModelSizeContext(text, rm.start, rm.end)) return;

      var aroundModel = normalizeOneLine(text.slice(Math.max(0, rm.start - 90), Math.min(text.length, rm.end + 180)));
      if (/MODEL|モデル|身長|体重|kg/i.test(aroundModel) && /(?:^|[^A-Za-z0-9])[BWH]\s*[:：]\s*\d/i.test(aroundModel)) return;

      var sep = rm.end > 0 ? text[rm.end - 1] : '';
      if (['・', '/', '／'].indexOf(sep) !== -1 && /^\d{1,3}(?:\.\d+)?$/.test(normalizeOneLine(sizeSymbol))) {
        var nearAfter = normalizeOneLine(text.slice(rm.end, rm.end + 14));
        var nearBefore = normalizeOneLine(text.slice(Math.max(0, rm.start - 24), rm.start));
        if (/^\d{1,3}\s*号/.test(nearAfter) || nearAfter.indexOf('号') !== -1) return;
        if (new RegExp(DIMENSION_LABEL_RE_SRC + '\\s*[:：]?\\s*$', 'i').test(nearBefore)) return;
        if (/(?:バスト|胸囲|着丈|身丈|肩幅|身幅|袖丈|裄丈|ゆき丈|ウエスト|ヒップ|股上|股下|総丈|裾幅|わたり|スカート丈|パンツ丈|身巾|肩巾)\s*$/i.test(nearBefore)) return;
      }
      if (['/', '／', '・'].indexOf(sep) !== -1 && /cm\s*[\(（]/i.test(sizeSymbol)) return;
      if (['/', '／'].indexOf(sep) !== -1 && /cm\s*$/i.test(normalizeOneLine(sizeSymbol))) {
        var nearBefore2 = normalizeOneLine(text.slice(Math.max(0, rm.start - 24), rm.start));
        if (new RegExp(DIMENSION_LABEL_RE_SRC + '\\s*[:：]?\\s*$', 'i').test(nearBefore2)) return;
      }
      if (['/', '／'].indexOf(sep) !== -1 && /^\s*(?:XXS|XS|SS|S|M|L|LL|XL|XXL|XXXL|(?:[2-9]|1[0-9])L)\b/i.test(text.slice(rm.end, rm.end + 12))) {
        var before2 = normalizeOneLine(text.slice(Math.max(0, rm.start - 20), rm.start));
        if (/サイズ\s*[:：]?$/.test(before2)) return;
      }
      matches.push(rm);
    });

    matches.forEach(function (rm, index) {
      var sizeSymbol = rm.size;
      var start = rm.end;
      var end = (index + 1 < matches.length) ? matches[index + 1].start : Math.min(text.length, start + 700);
      var block = text.slice(start, end);
      block = cutNoiseAfterBlock(block);

      var aroundBlock = normalizeOneLine(text.slice(Math.max(0, rm.start - 90), Math.min(text.length, end + 80)));
      if (/MODEL|モデル|身長|体重|kg/i.test(aroundBlock) && /(?:^|[^A-Za-z0-9])[BWH]\s*[:：]\s*\d/i.test(aroundBlock)) return;

      if (!hasEarlyDimensionLabel(block)) return;

      var parts = extractLabelValuePairs(block);
      var dimensionText = buildDimensionText(parts);
      if (dimensionText) {
        result[sizeSymbol] = { dimension_text: dimensionText, pattern: 'インラインコロン/スラッシュ寸法' };
      }
    });

    return result;
  }

  // ========================================================================
  // 抽出パターン: 空白見出しサイズ表
  // サイズ 背丈(cm) 胴回り(cm) 首回り(cm)
  // 2号 23 29~36 20~24
  // ========================================================================

  function extractFromSpaceHeaderSizeRows(htmlText) {
    var result = {};
    var text = htmlToText(htmlText);
    var flat = normalizeOneLine(text);

    var labelToken = DIMENSION_LABEL_RE_SRC + '(?:\\s*[\\(（][^\\)）]{0,20}[\\)）])?';
    var headerPattern = new RegExp(
      '(?:^|\\s)(?:サイズ\\s+)?(?<header>(?:' + labelToken + '\\s+){1,10}' + labelToken + ')\\s+' +
      '(?<body>.{0,1000}?)(?:【カラーバリエーション】|素材|原産国|注意事項|$)',
      'gi'
    );

    var sizeToken = SIZE_SYMBOL_RE_SRC + '|BM|BL|SHORT|LONG|ショート丈|ロング丈';
    var valueToken = '\\d+(?:\\.\\d+)?(?:\\s*[~〜～\\-]\\s*\\d+(?:\\.\\d+)?)?(?:cm|CM|mm|MM)?';
    var sizeRe = new RegExp('^(?:' + sizeToken + ')$', 'i');
    var valueRe = new RegExp('^' + valueToken + '$', 'i');

    var hm;
    while ((hm = headerPattern.exec(flat))) {
      var headerText = hm.groups.header;
      var body = hm.groups.body;

      var headers = [];
      var headerUnits = [];
      var lm;
      var labelTokenRe = new RegExp(labelToken, 'gi');
      while ((lm = labelTokenRe.exec(headerText))) {
        var rawHeader = lm[0];
        var unitMatch = rawHeader.match(/[\(（]\s*(cm|CM|mm|MM)\s*[\)）]/);
        var headerUnit = unitMatch ? unitMatch[1].toLowerCase() : '';
        var label = cleanDimensionLabel(rawHeader.replace(/[\(（][^\)）]*[\)）]/g, ''));
        if (label && reDIM('i').test(label)) { headers.push(label); headerUnits.push(headerUnit); }
        if (lm[0].length === 0) labelTokenRe.lastIndex++;
      }

      if (headers.length < 2) { if (hm[0].length === 0) headerPattern.lastIndex++; continue; }

      var tokens = body.trim().split(/\s+/).filter(Boolean);
      var i = 0;
      while (i < tokens.length) {
        var token = tokens[i];
        if (!sizeRe.test(token)) { i++; continue; }
        var sizeSymbol = normalizeOneLine(token);
        var rawValues = [];
        var j = i + 1;
        while (j < tokens.length && rawValues.length < headers.length) {
          if (!valueRe.test(tokens[j])) break;
          rawValues.push(tokens[j]);
          j++;
        }
        if (rawValues.length < headers.length) { i++; continue; }

        var values = rawValues.map(function (value, idx) {
          var headerUnit = headerUnits[idx];
          if (headerUnit && !/cm|CM|mm|MM|センチ|ミリ/.test(value)) return value + headerUnit;
          return value;
        });

        var pairs = headers.map(function (h, idx) { return [h, values[idx]]; });
        var dimensionText = buildDimensionTextNormalized(pairs);
        if (dimensionText) {
          result[sizeSymbol] = { dimension_text: dimensionText, pattern: '空白見出しサイズ表' };
        }
        i = j;
      }
      if (hm[0].length === 0) headerPattern.lastIndex++;
    }

    return result;
  }

  // ========================================================================
  // 抽出パターン: HTML表（列位置ベース、厳密表解析）
  // ========================================================================

  var TABLE_COMPONENT_WORDS = new Set(['ワンピース', 'トップス', 'パンツ', '上着', '上身頃', '本体', 'ベスト', 'コート', 'ブラウス', 'チュニック', 'キャミソール', 'ペチコート', 'ペチパンツ', 'チュール', 'サテン']);

  function isAuthoritativeTableSizeKey(value) {
    var v = normalizeOneLine(value);
    if (!v) return false;
    if (/^[\-－―ー—]$/.test(v)) return false;
    return new RegExp('^(?:' + SIZE_SYMBOL_RE_SRC + ')$', 'i').test(v) ||
      /^\d{1,3}(?:\.\d+)?号?$/.test(normalizeSizeSymbol(v));
  }

  function normalizeAuthoritativeTableLabel(label) {
    var value = normalizeOneLine(label);
    value = value.replace(/^[\s:：/／|｜]+|[\s:：/／|｜]+$/g, '');
    value = value.replace(/ウエウスト/g, 'ウエスト').replace(/ウェスト/g, 'ウエスト');
    value = value.replace(/巾/g, '幅');
    value = value.replace(/裾廻り/g, '裾周り').replace(/裾回り/g, '裾周り').replace(/裾まわり/g, '裾周り');
    value = value.replace(/渡り幅/g, 'わたり幅').replace(/ワタリ/g, 'わたり幅');
    value = value.replace(/膝幅/g, 'ひざ幅').replace(/ヒザ幅/g, 'ひざ幅');
    return value;
  }

  function parseAuthoritativeTableHeaders(headerRow) {
    var parsed = [];
    var currentComponent = '';
    for (var i = 1; i < headerRow.length; i++) {
      var raw = normalizeOneLine(headerRow[i]);
      if (!raw) { parsed.push(['', '']); continue; }
      var unitOnly = raw.match(/^(cm|mm|kg|g)$/i);
      if (unitOnly) { parsed.push(['対応サイズ', unitOnly[1].toLowerCase()]); continue; }
      var marker = raw.replace(/[()（）\[\]【】]/g, '');
      if (TABLE_COMPONENT_WORDS.has(marker)) { currentComponent = marker; parsed.push(['', '']); continue; }

      var labelSource = raw;
      var prefixMatch = raw.match(/^(.+?)[\/／:：](.+)$/);
      if (prefixMatch) {
        currentComponent = normalizeOneLine(prefixMatch[1]);
        labelSource = normalizeOneLine(prefixMatch[2]);
      } else {
        var sortedComponents = Array.from(TABLE_COMPONENT_WORDS).sort(function (a, b) { return b.length - a.length; });
        for (var c = 0; c < sortedComponents.length; c++) {
          var comp = sortedComponents[c];
          if (raw.indexOf(comp) === 0 && raw.length > comp.length) { currentComponent = comp; labelSource = raw.slice(comp.length); break; }
        }
      }
      var unitMatch = labelSource.match(/[\(（]\s*(cm|mm|kg|g)\s*[\)）]/i);
      var headerUnit = unitMatch ? unitMatch[1].toLowerCase() : '';
      labelSource = labelSource.replace(/[\(（]\s*(?:cm|mm|kg|g)\s*[\)）]/gi, '');
      var label = normalizeAuthoritativeTableLabel(labelSource);
      if (currentComponent && label && label.indexOf(currentComponent) !== 0) label = currentComponent + label;
      parsed.push([label, headerUnit]);
    }
    return parsed;
  }

  function parseAuthoritativeTableValue(valueText, headerUnit) {
    var text = normalizeOneLine(valueText);
    if (!text || ['-', '－', '―', 'ー', '—'].indexOf(text) !== -1) return null;
    var numbers = text.match(/\d+(?:\.\d+)?/g);
    if (!numbers) return null;
    var number = formatNumber(Math.max.apply(null, numbers.map(parseFloat)));
    var unit;
    if (/kg/i.test(text)) unit = 'kg';
    else if (/(?<!k)g/i.test(text)) unit = 'g';
    else if (/mm|ミリ/i.test(text)) unit = 'mm';
    else if (/cm|センチ/i.test(text)) unit = 'cm';
    else unit = headerUnit || 'cm';
    return [number, unit];
  }

  function isAuthoritativeTableDimensionHeader(label) {
    if (!label) return false;
    return reDIM('i').test(label) || /幅|丈|囲|höhe|高さ|奥行|重量|周り/i.test(label);
  }

  function extractFromAuthoritativeHtmlSizeTables(htmlText) {
    var result = {};
    var tables = extractTables(htmlText);
    tables.forEach(function (table) {
      if (table.length < 2) return;
      for (var headerIndex = 0; headerIndex < table.length - 1; headerIndex++) {
        var headerRow = table[headerIndex];
        if (headerRow.length < 2) continue;
        var firstHeader = normalizeOneLine(headerRow[0]);
        if (firstHeader && !/サイズ|SIZE|実寸/i.test(firstHeader)) continue;

        var parsedHeaders = parseAuthoritativeTableHeaders(headerRow);
        var meaningfulHeaders = parsedHeaders.filter(function (h) { return h[0] && isAuthoritativeTableDimensionHeader(h[0]); }).length;
        if (meaningfulHeaders < 1) continue;

        var validRows = 0;
        for (var r = headerIndex + 1; r < table.length; r++) {
          var row = table[r];
          if (!row || !row.length) continue;
          var sizeSymbol = normalizeOneLine(row[0]);
          if (!isAuthoritativeTableSizeKey(sizeSymbol)) continue;

          var parts = [];
          for (var ci = 0; ci < parsedHeaders.length; ci++) {
            var label = parsedHeaders[ci][0], headerUnit = parsedHeaders[ci][1];
            var columnIndex = ci + 1;
            if (!label || columnIndex >= row.length) continue;
            var parsedValue = parseAuthoritativeTableValue(row[columnIndex], headerUnit);
            if (!parsedValue) continue;
            parts.push(label + parsedValue[0] + parsedValue[1]);
          }
          if (!parts.length) continue;
          var dimensionText = parts.join(' ');
          dimensionText = normalizeDimensionTextForRakuten(dimensionText);
          dimensionText = cleanRedundantDimensionText(collapseDimensionRangesToMaxText(dimensionText));
          if (!dimensionText) continue;
          result[sizeSymbol] = { dimension_text: dimensionText, pattern: 'HTML表構造化サイズ表' };
          validRows++;
        }
        if (validRows) break;
      }
    });
    return result;
  }

  // ========================================================================
  // extract_dimension_map: 上記パターンを統合し、サニタイズする
  // ========================================================================

  function sanitizeDimensionMap(result) {
    if (!result) return result;
    var cleaned = {};
    Object.keys(result).forEach(function (key) {
      var data = result[key];
      if (!data) return;
      var text = normalizeDimensionTextForRakuten(data.dimension_text || '');
      if (!text) return;
      cleaned[key] = { dimension_text: text, pattern: data.pattern };
    });

    // __SINGLE__の安全判定（v69/v106の主要部分）
    if (cleaned.__SINGLE__) {
      var singleText = normalizeOneLine(cleaned.__SINGLE__.dimension_text || '');
      var singlePattern = cleaned.__SINGLE__.pattern || '';
      if (isUnsafeSingleDimensionText(singleText, singlePattern)) {
        delete cleaned.__SINGLE__;
      }
    }
    return cleaned;
  }

  function isUnsafeSingleDimensionText(text, pattern) {
    text = normalizeOneLine(text);
    if (!text) return true;
    var tokens = text.split(' ').filter(Boolean);

    if (tokens.length && tokens.every(function (t) { return /^[A-J]\d{2,3}(?:CM|cm)$/i.test(t); })) return true;
    if (/^トップ\d+(?:\.\d+)?(?:cm|mm)$/i.test(text)) return true;

    if (tokens.length && tokens.every(function (t) { return /^丈\d+(?:\.\d+)?(?:cm|mm)$/i.test(t); })) {
      var values = tokens.map(function (t) { return parseFloat(extractMaxNumber(t)); }).filter(function (v) { return !isNaN(v); });
      if (values.length && Math.max.apply(null, values) <= 15) return true;
    }
    if (tokens.length && tokens.every(function (t) { return /^アンダーバスト\d+(?:\.\d+)?(?:cm|mm)$/i.test(t); })) return true;

    var labels = [];
    tokens.forEach(function (t) { var m = t.match(/^([^\d\s]+)\d/); if (m) labels.push(m[1]); });
    if (tokens.length >= 2 && labels.length && new Set(labels).size === 1 && ['股下', '丈', 'サイズ', '対応センチ'].indexOf(labels[0]) !== -1) return true;

    return false;
  }

  function extractDimensionMap(htmlText) {
    var result = {};

    var fromInline = extractFromInlineColonOrSlash(htmlText);
    Object.keys(fromInline).forEach(function (k) { result[k] = fromInline[k]; });

    var fromSpaceHeader = extractFromSpaceHeaderSizeRows(htmlText);
    Object.keys(fromSpaceHeader).forEach(function (k) { if (!result[k]) result[k] = fromSpaceHeader[k]; });

    var fromTable = extractFromAuthoritativeHtmlSizeTables(htmlText);
    Object.keys(fromTable).forEach(function (k) { result[k] = fromTable[k]; }); // 表構造は信頼性が高いため上書き

    result = sanitizeDimensionMap(result);
    return result;
  }

  function getEffectiveDescriptionHtml(row) {
    return row[PC_DESCRIPTION_COL] || row[DESCRIPTION_COL] || '';
  }

  function extractDimensionMapWithPcPriority(row) {
    var pcHtml = row[PC_DESCRIPTION_COL] || '';
    var spHtml = row[DESCRIPTION_COL] || '';

    if (pcHtml) {
      var dm = extractDimensionMap(pcHtml);
      if (Object.keys(dm).length) return { dimensionMap: dm, descriptionHtml: pcHtml, sourceCol: PC_DESCRIPTION_COL };
    }
    if (spHtml) {
      var dm2 = extractDimensionMap(spHtml);
      return { dimensionMap: dm2, descriptionHtml: spHtml, sourceCol: DESCRIPTION_COL };
    }
    return { dimensionMap: {}, descriptionHtml: '', sourceCol: PC_DESCRIPTION_COL };
  }

  // ========================================================================
  // SKU照合エンジン (find_matching_dimension の主要ロジック)
  // ========================================================================

  function getVariationMatchCandidates(v1, v2) {
    var v1Exact = isExactKnownSizeChoiceForVariation(v1);
    var v2Exact = isExactKnownSizeChoiceForVariation(v2);
    if (v1Exact && !v2Exact) return [[VARIATION_1_COL, v1], [VARIATION_2_COL, v2]];
    if (v2Exact && !v1Exact) return [[VARIATION_2_COL, v2], [VARIATION_1_COL, v1]];

    var v1Size = isLikelySizeVariationValue(v1);
    var v2Size = isLikelySizeVariationValue(v2);
    if (v1Size && !v2Size) return [[VARIATION_1_COL, v1], [VARIATION_2_COL, v2]];
    if (v2Size && !v1Size) return [[VARIATION_2_COL, v2], [VARIATION_1_COL, v1]];

    return [[VARIATION_2_COL, v2], [VARIATION_1_COL, v1]];
  }

  function chooseDimensionTargetVariation(v1, v2) {
    var candidates = getVariationMatchCandidates(v1, v2);
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i][1] && isLikelySizeVariationValue(candidates[i][1])) return candidates[i];
    }
    if (v2) return [VARIATION_2_COL, v2];
    return [VARIATION_1_COL, v1];
  }

  function variationAlreadyContainsDimensionLabelValue(value) {
    var text = normalizeOneLine(value);
    if (!text) return false;
    if (/(?:股下|丈|サイズ|幅|高さ|縦|横|マチ|まち|長さ|厚さ|奥行|奥行き)\s*約?\d+(?:\.\d+)?\s*(?:cm|CM|mm|MM)?/.test(text)) return true;
    if (/\d+(?:\.\d+)?\s*(?:cm|CM|mm|MM)?\s*[×xX＊*]\s*\d+(?:\.\d+)?/.test(text)) return true;
    return false;
  }

  function isDimensionLikeVariationChoice(value) {
    var text = normalizeOneLine(value);
    if (!text) return false;
    if (/\d+(?:\.\d+)?\s*(?:cm|CM|mm|MM)?\s*[×xX＊*]\s*\d+(?:\.\d+)?/.test(text)) return true;
    if (/\d+(?:\.\d+)?\s*(?:cm|CM|mm|MM)\s*(?:用|タイプ|サイズ)?/.test(text)) return true;
    return false;
  }

  function findMatchingDimension(v1, v2, dimensionMap) {
    dimensionMap = dimensionMap || {};
    var candidates = getVariationMatchCandidates(v1, v2);
    var v2SizeLike = isLikelySizeVariationValue(v2);

    for (var ci = 0; ci < candidates.length; ci++) {
      var sourceCol = candidates[ci][0], value = candidates[ci][1];
      if (!value) continue;
      if (sourceCol === VARIATION_1_COL && v2SizeLike && !isLikelySizeVariationValue(value)) continue;

      var valueAliases = getSizeAliases(value);
      var valueRaw = normalizeOneLine(value);

      var best = null, bestScore = -999;
      Object.keys(dimensionMap).forEach(function (sizeSymbol) {
        if (sizeSymbol === '__SINGLE__' || isNoiseDimensionKey(sizeSymbol)) return;
        var data = dimensionMap[sizeSymbol];
        var sizeAliases = getSizeAliases(sizeSymbol);
        var sizeNorm = normalizeSizeSymbol(sizeSymbol);
        var sizeRaw = normalizeOneLine(sizeSymbol);
        var valueNorm = normalizeSizeSymbol(value);

        var matched = false, score = 0;
        if (valueRaw && valueRaw === sizeRaw) { matched = true; score += 120; }
        if (setHasIntersection(valueAliases, sizeAliases)) { matched = true; score += 80; }
        if (!matched) return;

        if (sizeNorm === valueNorm) score += 60;
        if (/^\d{1,3}(?:\.\d+)?$/.test(sizeNorm)) score += 50;
        if (/[\(（].*[\)）]/.test(sizeRaw)) score -= 220;

        if (best === null || score > bestScore) {
          bestScore = score;
          best = { matched: true, source_col: sourceCol, source_value: value, matched_size: sizeSymbol, dimension_text: data.dimension_text, pattern: data.pattern };
        }
      });

      if (best) {
        if (variationAlreadyContainsDimensionLabelValue(best.source_value)) continue;
        return best;
      }
    }

    // 商品共通(__SINGLE__)へのフォールバック
    if (dimensionMap.__SINGLE__) {
      var singleData = dimensionMap.__SINGLE__;
      var singleText = singleData.dimension_text;
      var singlePattern = singleData.pattern || '';
      if (singleText && !isUnsafeSingleDimensionText(singleText, singlePattern)) {
        if (!isDimensionLikeVariationChoice(v1) && !isDimensionLikeVariationChoice(v2) &&
          !variationAlreadyContainsDimensionLabelValue(v1) && !variationAlreadyContainsDimensionLabelValue(v2)) {
          var explicitKeys = Object.keys(dimensionMap).filter(function (k) {
            return k !== '__SINGLE__' && !isNoiseDimensionKey(k) && !/^\d+(?:\.\d+)?\s*(?:cm|CM|mm|MM)$/i.test(normalizeOneLine(k));
          });
          var useSingle = false;
          if (!explicitKeys.length) useSingle = true;
          else if (!isLikelySizeVariationValue(v1) && !isLikelySizeVariationValue(v2) && isCommonSingleDimensionText(singleText)) useSingle = true;
          else if (isCommonSingleDimensionText(singleText)) useSingle = true;

          if (useSingle) {
            var target = chooseDimensionTargetVariation(v1, v2);
            return { matched: true, source_col: target[0], source_value: target[1], matched_size: '__SINGLE__', dimension_text: singleText, pattern: singlePattern + '+単一寸法' };
          }
        }
      }
    }

    // 名称部分一致（色・柄名にサイズキーが含まれる場合）
    for (var ci2 = 0; ci2 < candidates.length; ci2++) {
      var sourceCol2 = candidates[ci2][0], value2 = candidates[ci2][1];
      if (!value2) continue;
      var normalizedValue = normalizeOneLine(value2);
      var matchResult = null;
      Object.keys(dimensionMap).forEach(function (sizeSymbol) {
        if (matchResult) return;
        if (sizeSymbol === '__SINGLE__' || isNoiseDimensionKey(sizeSymbol)) return;
        var normalizedSymbol = normalizeOneLine(sizeSymbol);
        if (normalizedSymbol.length >= 2 && normalizedValue.indexOf(normalizedSymbol) !== -1) {
          if (variationAlreadyContainsDimensionLabelValue(value2)) return;
          matchResult = { matched: true, source_col: sourceCol2, source_value: value2, matched_size: sizeSymbol, dimension_text: dimensionMap[sizeSymbol].dimension_text, pattern: dimensionMap[sizeSymbol].pattern + '+名称部分一致' };
        }
      });
      if (matchResult) return matchResult;
    }

    return { matched: false, source_col: '', source_value: '', matched_size: '', dimension_text: '', pattern: '' };
  }

  function buildRewrittenVariation(sizeValue, dimensionText) {
    sizeValue = normalizeOneLinePreserveForm(sizeValue);
    dimensionText = cleanRedundantDimensionText(collapseDimensionRangesToMaxText(dimensionText));
    if (!sizeValue && !dimensionText) return '';
    if (!dimensionText) return sizeValue;
    if (sizeValue) return sizeValue + ' ' + dimensionText;
    return dimensionText;
  }

  // ========================================================================
  // 診断・レポート系
  // ========================================================================

  function chooseSkuSizeValueForDiagnosis(v1, v2) {
    var candidates = getVariationMatchCandidates(v1, v2);
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i][1] && isLikelySizeVariationValue(candidates[i][1])) return candidates[i];
    }
    if (v2) return [VARIATION_2_COL, v2];
    return [VARIATION_1_COL, v1];
  }

  function getDimensionSizeListForDiagnosis(dimensionMap) {
    if (!dimensionMap) return '';
    var out = [];
    Object.keys(dimensionMap).forEach(function (sizeSymbol) {
      if (sizeSymbol === '__SINGLE__') { out.push('__SINGLE__'); return; }
      if (isNoiseDimensionKey(sizeSymbol)) return;
      var normalized = normalizeSizeSymbol(sizeSymbol);
      if (normalized && normalized !== sizeSymbol) out.push(sizeSymbol + '=>' + normalized);
      else out.push(String(sizeSymbol));
    });
    return out.join(' / ');
  }

  function formatAliasesForReport(value) {
    var aliases = Array.from(getSizeAliases(value)).sort();
    if (!aliases.length) return '';
    return aliases.join('/');
  }

  function getMatchCandidatesForDiagnosis(v1, v2, dimensionMap) {
    if (!dimensionMap) return '';
    var chosen = chooseSkuSizeValueForDiagnosis(v1, v2);
    var sourceValue = chosen[1];
    var skuAliases = getSizeAliases(sourceValue);
    var exactCandidates = [], partialCandidates = [], allSizeKeys = [];

    Object.keys(dimensionMap).forEach(function (sizeSymbol) {
      if (sizeSymbol === '__SINGLE__') { allSizeKeys.push('__SINGLE__'); return; }
      if (isNoiseDimensionKey(sizeSymbol)) return;
      allSizeKeys.push(String(sizeSymbol));
      var sizeAliases = getSizeAliases(sizeSymbol);
      if (setHasIntersection(skuAliases, sizeAliases)) { exactCandidates.push(String(sizeSymbol)); return; }
      var skuNorm = normalizeSizeSymbol(sourceValue);
      var sizeNorm = normalizeSizeSymbol(sizeSymbol);
      if (skuNorm && sizeNorm && (sizeNorm.indexOf(skuNorm) !== -1 || skuNorm.indexOf(sizeNorm) !== -1)) partialCandidates.push(String(sizeSymbol));
    });

    if (exactCandidates.length) return '一致候補:' + exactCandidates.join('/');
    if (partialCandidates.length) return '部分候補:' + partialCandidates.join('/');
    if (allSizeKeys.length) return '説明文側候補:' + allSizeKeys.join('/');
    return '';
  }

  function buildUntransferredDiagnosisMemo(v1, v2, dimensionMap, match) {
    var chosen = chooseSkuSizeValueForDiagnosis(v1, v2);
    var sourceCol = chosen[0], sourceValue = chosen[1];
    var skuNorm = normalizeSizeSymbol(sourceValue);
    var skuAliases = getSizeAliases(sourceValue);

    if (match && match.matched) {
      var matchedNorm = normalizeSizeSymbol(match.matched_size);
      return '照合成功。SKU推定列=' + sourceCol + '、SKU正規化=' + skuNorm + '、説明文照合サイズ=' + match.matched_size + '、説明文正規化=' + matchedNorm;
    }
    if (!dimensionMap || !Object.keys(dimensionMap).length) {
      return '寸法抽出マップなし。SKU推定列=' + sourceCol + '、SKU正規化=' + skuNorm + '。説明文に商品寸法が無い、または未対応表記の可能性あり';
    }
    var nonNoiseKeys = Object.keys(dimensionMap).filter(function (k) { return k !== '__SINGLE__' && !isNoiseDimensionKey(k); });
    if (dimensionMap.__SINGLE__ && !nonNoiseKeys.length) {
      return '単一寸法のみ抽出。SKU推定列=' + sourceCol + '、SKU正規化=' + skuNorm + '。単一寸法フォールバック条件に合わず未転記、または安全判定で停止';
    }
    if (nonNoiseKeys.length) {
      var matchedByAlias = nonNoiseKeys.filter(function (k) { return setHasIntersection(skuAliases, getSizeAliases(k)); });
      if (matchedByAlias.length) return '同義候補は存在するが転記未成功。候補=' + matchedByAlias.join(',') + '。照合ロジックの追加確認が必要';
      return '説明文側抽出サイズにSKU正規化=' + skuNorm + 'と同義のサイズが見当たらないため未転記。近似転記は禁止';
    }
    return '寸法らしき情報は抽出されたが、有効なサイズキーがない。SKU推定列=' + sourceCol + '、SKU正規化=' + skuNorm;
  }

  // ========================================================================
  // 透け感転記 (v152)
  // ========================================================================

  function normalizeTransparencyText(value) {
    var v = unescapeHtml(String(value == null ? '' : value));
    v = nfkc(v);
    v = v.replace(/\u3000/g, ' ');
    v = v.replace(/[ \t]+/g, ' ');
    return v.trim();
  }

  function cleanTransparencyNameToken(value) {
    var v = normalizeTransparencyText(value);
    v = v.replace(/^[\s\t:：,，、/／・|｜;；\-\[\]［］【】]+|[\s\t:：,，、/／・|｜;；\-\[\]［］【】]+$/g, '');
    v = v.replace(/^(?:カラー|色)\s*[:：]\s*/i, '');
    var suffixRe = /(?:のみ|だけ|は|が|に限り|にかぎり|にのみ|部分|一部|光に透かすと|光にかざすと|ほんのり|やや|若干|多少|少し|わずかに|わずか)$/i;
    var previous = null;
    while (v && v !== previous) {
      previous = v;
      v = v.replace(suffixRe, '').replace(/^[\s\t:：,，、/／・|｜;；\-]+|[\s\t:：,，、/／・|｜;；\-]+$/g, '');
    }
    return v;
  }

  function isGenericTransparencyPhrase(value) {
    var v = normalizeTransparencyText(value);
    var compact = v.replace(/[\s:：,，、/／・|｜;；()（）\[\]［］【】\-_]/g, '').toLowerCase();
    if (!compact) return true;
    var exactGeneric = new Set(['あり', '有り', '有', 'やや', '若干', '多少', '少し', 'ほんのり', 'わずか', 'わずかに', '一部', '部分的に', '全体', '全体的に', '薄い色', '薄色', '淡色', '色の薄い', '色の薄い部分', '色の薄い箇所', '光に透かすと', '光にかざすと', '光の加減で', 'カラーによる', '色による']);
    if (exactGeneric.has(compact)) return true;
    var genericWords = ['編み目', '網目', '隙間', 'すき間', 'メッシュ', 'レース', 'シアー', '生地全体', '部分的', '光に透か', '光にかざ', '色の薄い部分', '薄い色'];
    return genericWords.some(function (w) { return compact.indexOf(w.toLowerCase()) !== -1; });
  }

  function splitTransparencyNameTokens(value) {
    var v = normalizeTransparencyText(value);
    if (!v) return [];
    var tokens = v.split(/\s*(?:、|,|，|\/|／|・|\||｜|;|；|および|及び|ならびに|並びに)\s*/);
    var out = [];
    tokens.forEach(function (t) { var c = cleanTransparencyNameToken(t); if (c) out.push(c); });
    return out;
  }

  function extractTransparencyFieldBodies(descriptionHtml) {
    var text = htmlToText(descriptionHtml || '');
    if (!text) return [];
    var bodies = [];
    var re1 = /透け感\s*[:：]\s*([^\r\n]{0,320})/gi;
    var m;
    while ((m = re1.exec(text))) {
      var body = normalizeTransparencyText(m[1]);
      body = body.split(/\s*(?:裏地|厚さ|生地の厚さ|伸縮性|ポケット|洗濯方法|素材|生産国|原産国)\s*[:：]/i)[0].trim();
      bodies.push(body);
    }
    var re2 = /透け感\s*((?:なし|無し|無|(?:ほんのり|やや|若干|多少|少し|わずか(?:に)?|一部|部分的に)?\s*(?:あり|有り|有))[^\r\n]{0,100})/gi;
    while ((m = re2.exec(text))) {
      var body2 = normalizeTransparencyText(m[1]);
      body2 = body2.split(/\s*(?:裏地|厚さ|生地の厚さ|伸縮性|ポケット|洗濯方法|素材)\s*[:：]/i)[0].trim();
      if (bodies.indexOf(body2) === -1) bodies.push(body2);
    }
    return bodies;
  }

  var TRANSPARENCY_POSITIVE_MARKER_RE = /(?:ほんのり|やや|若干|多少|少し|わずか(?:に)?|部分的に|一部)?\s*(?:あり|有り|有)/gi;

  function parseTransparencyBody(bodyIn) {
    var body = normalizeTransparencyText(bodyIn);
    if (!body) return { all: false, names: new Set() };
    if (/^(?:なし|無し|無|なしです|無しです)$/i.test(body)) return { all: false, names: new Set() };

    var matches = [];
    var re = new RegExp(TRANSPARENCY_POSITIVE_MARKER_RE.source, 'gi');
    var m;
    while ((m = re.exec(body))) { matches.push(m); if (m[0].length === 0) re.lastIndex++; }

    var names = new Set();
    var applyAll = false;

    if (matches.length) {
      var previousEnd = 0;
      matches.forEach(function (marker) {
        var prefix = body.slice(previousEnd, marker.index);
        previousEnd = marker.index + marker[0].length;
        prefix = prefix.replace(/^.*(?:なし|無し|無)\s*[、,，;；]\s*/i, '');
        prefix = prefix.replace(/^[\s\t:：,，、/／・|｜;；\-]+|[\s\t:：,，、/／・|｜;；\-]+$/g, '');

        if (!prefix) {
          var after = body.slice(marker.index + marker[0].length);
          var paren = after.match(/^\s*[\(（\[［【]\s*([^\)）\]］】]{1,180})\s*[\)）\]］】]/);
          if (paren) prefix = paren[1];
        }

        var cleanedPrefix = cleanTransparencyNameToken(prefix);
        if (!cleanedPrefix || isGenericTransparencyPhrase(cleanedPrefix)) { applyAll = true; return; }

        var clauseNames = splitTransparencyNameTokens(cleanedPrefix);
        if (!clauseNames.length) { applyAll = true; return; }

        var specificFound = false;
        clauseNames.forEach(function (name) {
          if (isGenericTransparencyPhrase(name)) applyAll = true;
          else { names.add(name); specificFound = true; }
        });
        if (!specificFound && !names.size) applyAll = true;
      });
    } else {
      if (/(?:なし|無し|無)/i.test(body)) return { all: false, names: new Set() };
      var implicit = cleanTransparencyNameToken(body);
      if (!implicit) return { all: false, names: new Set() };
      if (isGenericTransparencyPhrase(implicit)) applyAll = true;
      else splitTransparencyNameTokens(implicit).forEach(function (n) { names.add(n); });
    }

    var outNames = new Set();
    names.forEach(function (n) { if (n) outNames.add(n); });
    return { all: !!applyAll, names: outNames };
  }

  function extractTransparencyRule(descriptionHtml) {
    var combined = { all: false, names: new Set() };
    extractTransparencyFieldBodies(descriptionHtml).forEach(function (body) {
      var rule = parseTransparencyBody(body);
      combined.all = combined.all || rule.all;
      rule.names.forEach(function (n) { combined.names.add(n); });
    });
    return combined;
  }

  function transparencyNameKeys(value) {
    var v = normalizeTransparencyText(value);
    if (!v) return new Set();
    v = v.replace(/\s+(?:(?:透け感\s*)?(?:あり|有り))(?:\s|$).*/i, '').trim();
    v = v.replace(/^(?:[A-Z0-9]{1,8})\s*[:：_]\s*/i, '');

    var candidates = new Set([v]);
    var descriptive = v.match(/^([^()（）]{1,80})\s*[\(（][^()（）]{1,160}[\)）]\s*$/);
    if (descriptive) candidates.add(descriptive[1].trim());
    v.split(/\s*(?:\/|／|・|×|x|X|\||｜)\s*/).forEach(function (x) { if (x.trim()) candidates.add(x.trim()); });

    var keys = new Set();
    candidates.forEach(function (c) {
      c = c.replace(/^[\s\t:：,，、/／・|｜;；\-]+|[\s\t:：,，、/／・|｜;；\-]+$/g, '');
      if (!c) return;
      var folded = c.toLowerCase();
      keys.add(folded);
      var compact = folded.replace(/[\s\-_]/g, '');
      if (compact) keys.add(compact);
    });
    return keys;
  }

  function variationMatchesTransparencyName(variationValue, name) {
    return setHasIntersection(transparencyNameKeys(variationValue), transparencyNameKeys(name));
  }

  function appendTransparencyYes(value) {
    var v = normalizeOneLinePreserveForm(value);
    if (!v) return '透け感あり';
    if (/(?:^|\s)透け感あり(?:\s|$)/.test(v)) return v;
    if (/(?:^|\s)(?:あり|有り)\s*$/.test(v)) return v.replace(/(?:^|\s)(?:あり|有り)\s*$/, ' 透け感あり').trim();
    return v + ' 透け感あり';
  }

  // ========================================================================
  // バスト身幅比率判定 (v143)
  // ========================================================================

  var BUST_TOKEN_RE = /^(?<label>[^\d]+)(?<value>\d+(?:\.\d+)?)(?<unit>cm|mm)$/i;
  var BUST_EXPLICIT_FLAT_LABELS = new Set(['身幅', 'バスト幅']);
  var BUST_SHOULDER_LABELS = new Set(['肩幅', '肩巾']);
  var BUST_SLEEVE_WIDTH_LABELS = new Set(['袖幅', '袖巾']);
  var BUST_FLAT_HEM_LABELS = new Set(['裾幅']);
  var BUST_BODY_CIRC_LABELS = new Set(['ウエスト', 'ウェスト', 'ヒップ']);
  var BUST_HEM_CIRC_LABELS = new Set(['裾周り', 'すそ周り']);

  function parseDimensionEntriesForBust(dimensionText) {
    var entries = {};
    normalizeOneLine(dimensionText).split(' ').forEach(function (token) {
      if (!token) return;
      var m = token.match(BUST_TOKEN_RE);
      if (!m) return;
      var label = cleanDimensionLabel(m.groups.label);
      var unit = m.groups.unit.toLowerCase();
      var value = parseFloat(m.groups.value);
      if (isNaN(value)) return;
      if (unit === 'mm') value /= 10.0;
      if (!entries[label]) entries[label] = [];
      entries[label].push(value);
    });
    return entries;
  }

  function ratioVote(mode, sizeSymbol, family, label, ratio, strength) {
    return { mode: mode, size: normalizeOneLine(sizeSymbol), family: family, label: label, ratio: ratio, strength: strength };
  }

  function analyzeBustRatioMode(dimensionMap) {
    var rows = [];
    var hasExplicitFlat = false, bustSizeCount = 0;
    Object.keys(dimensionMap || {}).forEach(function (sizeSymbol) {
      var data = dimensionMap[sizeSymbol];
      if (!data) return;
      var entries = parseDimensionEntriesForBust(data.dimension_text || '');
      if (!Object.keys(entries).length) return;
      Object.keys(entries).forEach(function (l) { if (BUST_EXPLICIT_FLAT_LABELS.has(l)) hasExplicitFlat = true; });
      if (entries['バスト']) bustSizeCount++;
      rows.push([sizeSymbol, entries]);
    });

    if (bustSizeCount === 0) return { mode: 'none', reason: '裸のバスト記載なし', evidence: [], bust_size_count: 0 };
    if (hasExplicitFlat) return { mode: 'explicit', reason: '身幅・バスト幅等の平置き幅が明示されているため比率判定不要', evidence: [], bust_size_count: bustSizeCount };

    var evidence = [];
    rows.forEach(function (row) {
      var sizeSymbol = row[0], entries = row[1];
      if (!entries['バスト']) return;
      var bust = entries['バスト'][0];
      if (bust <= 0) return;

      BUST_SHOULDER_LABELS.forEach(function (label) {
        if (!entries[label] || entries[label][0] <= 0) return;
        var ratio = bust / entries[label][0];
        if (ratio >= 1.05 && ratio <= 1.75) evidence.push(ratioVote('flat', sizeSymbol, 'shoulder', label, ratio, 'strong'));
        else if (ratio >= 2.05 && ratio <= 3.50) evidence.push(ratioVote('circ', sizeSymbol, 'shoulder', label, ratio, 'strong'));
      });
      BUST_SLEEVE_WIDTH_LABELS.forEach(function (label) {
        if (!entries[label] || entries[label][0] <= 0) return;
        var ratio = bust / entries[label][0];
        if (ratio >= 1.80 && ratio <= 3.90) evidence.push(ratioVote('flat', sizeSymbol, 'sleeve', label, ratio, 'strong'));
        else if (ratio >= 4.50 && ratio <= 8.50) evidence.push(ratioVote('circ', sizeSymbol, 'sleeve', label, ratio, 'strong'));
      });
      BUST_FLAT_HEM_LABELS.forEach(function (label) {
        if (!entries[label] || entries[label][0] <= 0) return;
        var ratio = bust / entries[label][0];
        if (ratio >= 0.70 && ratio <= 1.40) evidence.push(ratioVote('flat', sizeSymbol, 'flat_hem', label, ratio, 'strong'));
        else if (ratio >= 1.60 && ratio <= 2.50) evidence.push(ratioVote('circ', sizeSymbol, 'flat_hem', label, ratio, 'strong'));
      });
      BUST_BODY_CIRC_LABELS.forEach(function (label) {
        if (!entries[label] || entries[label][0] <= 0) return;
        var ratio = bust / entries[label][0];
        if (ratio >= 0.38 && ratio <= 0.68) evidence.push(ratioVote('flat', sizeSymbol, 'body_circ', label, ratio, 'strong'));
        else if (ratio >= 0.78 && ratio <= 1.30) evidence.push(ratioVote('circ', sizeSymbol, 'body_circ', label, ratio, 'strong'));
      });
      BUST_HEM_CIRC_LABELS.forEach(function (label) {
        if (!entries[label] || entries[label][0] <= 0) return;
        var ratio = bust / entries[label][0];
        if (ratio >= 0.38 && ratio <= 0.68) evidence.push(ratioVote('flat', sizeSymbol, 'hem_circ', label, ratio, 'weak'));
        else if (ratio >= 0.78 && ratio <= 1.25) evidence.push(ratioVote('circ', sizeSymbol, 'hem_circ', label, ratio, 'weak'));
      });
    });

    var familyModes = {};
    evidence.forEach(function (vote) {
      familyModes[vote.family] = familyModes[vote.family] || { flat: new Set(), circ: new Set() };
      familyModes[vote.family][vote.mode].add(vote.size);
    });

    var strongSupport = { flat: new Set(), circ: new Set() };
    var weakSupport = { flat: new Set(), circ: new Set() };
    Object.keys(familyModes).forEach(function (family) {
      ['flat', 'circ'].forEach(function (mode) {
        var sizes = familyModes[family][mode];
        if (sizes.size < 2) return;
        if (family === 'hem_circ') weakSupport[mode].add(family);
        else strongSupport[mode].add(family);
      });
    });

    if (strongSupport.flat.size && strongSupport.circ.size) {
      return { mode: 'unknown', reason: '肩幅・袖幅・裾幅等の比較項目群で、平置き幅と周囲寸法の判定が衝突', evidence: evidence, bust_size_count: bustSizeCount };
    }

    var pairs = [['flat', 'circ', '平置き身幅'], ['circ', 'flat', '周囲寸法']];
    for (var pi = 0; pi < pairs.length; pi++) {
      var mode = pairs[pi][0], otherMode = pairs[pi][1], labelJa = pairs[pi][2];
      if (strongSupport[mode].size >= 2 && !strongSupport[otherMode].size) {
        return { mode: mode, reason: strongSupport[mode].size + '種類の独立した比率関係が複数サイズで' + labelJa + 'と一致', evidence: evidence, bust_size_count: bustSizeCount };
      }
      if (strongSupport[mode].size >= 1 && weakSupport[mode].size && !strongSupport[otherMode].size && !weakSupport[otherMode].size) {
        return { mode: mode, reason: '主要な比率関係と裾周りとの比率が複数サイズで' + labelJa + 'と一致', evidence: evidence, bust_size_count: bustSizeCount };
      }
    }

    var evidenceModes = new Set(evidence.map(function (v) { return v.mode; }));
    var reason;
    if (evidenceModes.size >= 2) reason = 'サイズまたは比較項目によって、平置き幅と周囲寸法の判定が一致しない';
    else if (evidence.length) reason = '高信頼判定に必要な複数種類・複数サイズの比率根拠が不足';
    else reason = '肩幅・袖幅・裾幅・ウエスト・ヒップ等の比較可能な寸法が不足';

    return { mode: 'unknown', reason: reason, evidence: evidence, bust_size_count: bustSizeCount };
  }

  function formatBustRatioEvidence(analysis, limit) {
    limit = limit || 20;
    var formatted = [];
    var modeLabel = { flat: '平置き', circ: '周囲' };
    (analysis.evidence || []).forEach(function (vote) {
      var text = vote.size + ':バスト/' + vote.label + '=' + vote.ratio.toFixed(2) + '→' + (modeLabel[vote.mode] || vote.mode);
      if (formatted.indexOf(text) === -1 && formatted.length < limit) formatted.push(text);
    });
    return formatted.join(' / ');
  }

  function formatDerivedDimensionValue(value) {
    try { return formatNumber(parseFloat(value)); } catch (e) { return String(value || ''); }
  }

  function canonicalizeDimensionTextForBust(dimensionText, bustMode) {
    var source = normalizeOneLine(dimensionText);
    if (!source) return source;
    var output = [];
    var seenTokens = new Set();

    function appendEntry(label, value, unit) {
      if (!label || !value || !unit) return;
      var token = label + value + unit;
      if (seenTokens.has(token)) return;
      seenTokens.add(token);
      output.push(token);
    }

    source.split(' ').forEach(function (token) {
      var m = token.match(BUST_TOKEN_RE);
      if (!m) { if (!seenTokens.has(token)) { seenTokens.add(token); output.push(token); } return; }
      var label = cleanDimensionLabel(m.groups.label);
      var value = m.groups.value, unit = m.groups.unit.toLowerCase();

      if (label === 'バスト') {
        if (bustMode === 'flat') {
          appendEntry('身幅', value, unit);
          try { appendEntry('バスト', formatDerivedDimensionValue(parseFloat(value) * 2.0), unit); } catch (e) {}
        } else if (bustMode === 'circ') {
          appendEntry('バスト', value, unit);
          try { appendEntry('身幅', formatDerivedDimensionValue(parseFloat(value) / 2.0), unit); } catch (e) {}
        } else {
          appendEntry('バスト', value, unit);
        }
        return;
      }
      appendEntry(label, value, unit);
    });

    return output.join(' ').trim();
  }

  return {
    // 定数
    ITEM_KEY_COL: ITEM_KEY_COL, ITEM_NAME_COL: ITEM_NAME_COL, SKU_COL: SKU_COL,
    VARIATION_1_COL: VARIATION_1_COL, VARIATION_2_COL: VARIATION_2_COL,
    DESCRIPTION_COL: DESCRIPTION_COL, PC_DESCRIPTION_COL: PC_DESCRIPTION_COL, GENRE_ID_COL: GENRE_ID_COL,
    OUTPUT_VARIATION_1_COL: OUTPUT_VARIATION_1_COL, OUTPUT_VARIATION_2_COL: OUTPUT_VARIATION_2_COL,
    OUTPUT_PATTERN_COL: OUTPUT_PATTERN_COL, OUTPUT_MATCH_SIZE_COL: OUTPUT_MATCH_SIZE_COL,
    OUTPUT_STATUS_COL: OUTPUT_STATUS_COL, OUTPUT_SKU_NORMALIZED_SIZE_COL: OUTPUT_SKU_NORMALIZED_SIZE_COL,
    OUTPUT_DESCRIPTION_SIZE_LIST_COL: OUTPUT_DESCRIPTION_SIZE_LIST_COL,
    OUTPUT_MATCH_CANDIDATES_COL: OUTPUT_MATCH_CANDIDATES_COL, OUTPUT_UNTRANSFERRED_MEMO_COL: OUTPUT_UNTRANSFERRED_MEMO_COL,
    DIMENSION_LABEL_RE_SRC: DIMENSION_LABEL_RE_SRC, SIZE_SYMBOL_RE_SRC: SIZE_SYMBOL_RE_SRC,
    reDIM: reDIM, reSIZE: reSIZE,
    // ヘルパー
    normalizeText: normalizeText, normalizeOneLine: normalizeOneLine, normalizeOneLinePreserveForm: normalizeOneLinePreserveForm,
    formatNumber: formatNumber, extractMaxNumber: extractMaxNumber, cleanDimensionLabel: cleanDimensionLabel,
    normalizeOutputLabel: normalizeOutputLabel, htmlToText: htmlToText, extractTables: extractTables,
    normalizeSizeSymbol: normalizeSizeSymbol, getSizeAliases: getSizeAliases, setHasIntersection: setHasIntersection,
    isExactKnownSizeChoiceForVariation: isExactKnownSizeChoiceForVariation,
    isLikelySizeVariationValue: isLikelySizeVariationValue, isNoiseDimensionKey: isNoiseDimensionKey,
    isCommonSingleDimensionText: isCommonSingleDimensionText, isStandardAlphaSizeKey: isStandardAlphaSizeKey,
    isNumericSizeKey: isNumericSizeKey,
    buildDimensionText: buildDimensionText, buildDimensionTextNormalized: buildDimensionTextNormalized,
    collapseDimensionRangesToMaxText: collapseDimensionRangesToMaxText, cleanRedundantDimensionText: cleanRedundantDimensionText,
    normalizeDimensionTextForRakuten: normalizeDimensionTextForRakuten,
    // 抽出・マップ
    extractLabelValuePairs: extractLabelValuePairs,
    extractFromInlineColonOrSlash: extractFromInlineColonOrSlash,
    extractFromSpaceHeaderSizeRows: extractFromSpaceHeaderSizeRows,
    extractFromAuthoritativeHtmlSizeTables: extractFromAuthoritativeHtmlSizeTables,
    extractDimensionMap: extractDimensionMap,
    extractDimensionMapWithPcPriority: extractDimensionMapWithPcPriority,
    getEffectiveDescriptionHtml: getEffectiveDescriptionHtml,
    isUnsafeSingleDimensionText: isUnsafeSingleDimensionText,
    // 照合
    getVariationMatchCandidates: getVariationMatchCandidates,
    chooseDimensionTargetVariation: chooseDimensionTargetVariation,
    findMatchingDimension: findMatchingDimension,
    buildRewrittenVariation: buildRewrittenVariation,
    variationAlreadyContainsDimensionLabelValue: variationAlreadyContainsDimensionLabelValue,
    isDimensionLikeVariationChoice: isDimensionLikeVariationChoice,
    // 診断
    chooseSkuSizeValueForDiagnosis: chooseSkuSizeValueForDiagnosis,
    getDimensionSizeListForDiagnosis: getDimensionSizeListForDiagnosis,
    formatAliasesForReport: formatAliasesForReport,
    getMatchCandidatesForDiagnosis: getMatchCandidatesForDiagnosis,
    buildUntransferredDiagnosisMemo: buildUntransferredDiagnosisMemo,
    // 透け感
    extractTransparencyRule: extractTransparencyRule,
    variationMatchesTransparencyName: variationMatchesTransparencyName,
    appendTransparencyYes: appendTransparencyYes,
    // バスト比率
    analyzeBustRatioMode: analyzeBustRatioMode,
    formatBustRatioEvidence: formatBustRatioEvidence,
    canonicalizeDimensionTextForBust: canonicalizeDimensionTextForBust
  };
});
