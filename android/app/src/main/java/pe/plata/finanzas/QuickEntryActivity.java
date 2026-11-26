package pe.plata.finanzas;

import android.app.Activity;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.text.InputType;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;

/**
 * Registro rápido nativo que se abre desde el widget, sin cargar la app completa:
 * monto en el teclado → Guardar. La categoría llega preseleccionada desde el widget.
 */
public class QuickEntryActivity extends Activity {

    static final String EXTRA_CATEGORY = "categoryId";
    private static final int MAX_DIGITS = 9;

    private JSONObject snap;
    private String type = "expense";
    private String categoryId;
    private String accountId;
    private final StringBuilder digits = new StringBuilder();

    private TextView amountView;
    private TextView titleView;
    private TextView emojiView;
    private GridLayout categoryRow;
    private GridLayout accountRow;
    private TextView typeExpense;
    private TextView typeIncome;
    private TextView saveButton;
    private EditText noteInput;

    // Paleta (claro / oscuro)
    private int cBg, cSurface2, cInk, cMuted, cLine, cBrand, cBrandInk, cNeg, cPos;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        Window w = getWindow();
        w.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        // El teclado del sistema solo aparece al tocar la nota; la hoja sube para no quedar tapada.
        w.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

        // Siempre claro, con el mismo sistema visual de la app.
        cBg = 0xFFFFFFFF;
        cSurface2 = 0xFFF2F4F6;
        cInk = 0xFF111827;
        cMuted = 0xFF6B7280;
        cLine = 0xFFE5E7EB;
        cBrand = 0xFF0E5A48;
        cBrandInk = 0xFFFFFFFF;
        cNeg = 0xFFB93838;
        cPos = 0xFF0D7A55;

        snap = WidgetStore.snapshot(this);
        categoryId = getIntent().getStringExtra(EXTRA_CATEGORY);
        if (snap != null) {
            accountId = snap.optString("lastAccountId", null);
            if (accountId == null || accountId.isEmpty() || findById(snap.optJSONArray("accounts"), accountId) == null) {
                accountId = snap.optString("defaultAccountId", null);
            }
            JSONArray accs = snap.optJSONArray("accounts");
            if ((accountId == null || accountId.isEmpty() || findById(accs, accountId) == null) && accs != null && accs.length() > 0) {
                accountId = accs.optJSONObject(0).optString("id");
            }
        }
        setContentView(buildUi());
        refresh();
    }

    // ───────────────────────── UI ─────────────────────────

    private View buildUi() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0x99000000);
        root.setOnClickListener(v -> finish());

        LinearLayout sheet = new LinearLayout(this);
        sheet.setOrientation(LinearLayout.VERTICAL);
        sheet.setClickable(true);
        sheet.setPadding(dp(20), dp(10), dp(20), dp(20));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(cBg);
        float r = dp(28);
        bg.setCornerRadii(new float[]{r, r, r, r, 0, 0, 0, 0});
        sheet.setBackground(bg);
        FrameLayout.LayoutParams slp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
        root.addView(sheet, slp);

        // Asa
        View handle = new View(this);
        handle.setBackground(round(cLine, dp(3)));
        LinearLayout.LayoutParams hlp = new LinearLayout.LayoutParams(dp(40), dp(5));
        hlp.gravity = Gravity.CENTER_HORIZONTAL;
        hlp.bottomMargin = dp(14);
        sheet.addView(handle, hlp);

        if (snap == null || snap.optJSONArray("accounts") == null || snap.optJSONArray("accounts").length() == 0) {
            TextView msg = text("Abre Plata y crea una cuenta para usar el widget.", 16, cInk, false);
            msg.setGravity(Gravity.CENTER);
            msg.setPadding(0, dp(16), 0, dp(16));
            sheet.addView(msg);
            TextView open = button("Abrir Plata");
            open.setOnClickListener(v -> {
                startActivity(new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                finish();
            });
            sheet.addView(open);
            return root;
        }

        // Encabezado: emoji + título + tipo
        LinearLayout header = new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        emojiView = text("G", 18, cBrand, true);
        emojiView.setGravity(Gravity.CENTER);
        emojiView.setBackground(round(0xFFE8F1EE, dp(22)));
        header.addView(emojiView, new LinearLayout.LayoutParams(dp(44), dp(44)));
        titleView = text("Nuevo gasto", 17, cInk, true);
        titleView.setPadding(dp(12), 0, 0, 0);
        header.addView(titleView, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));

        LinearLayout toggle = new LinearLayout(this);
        toggle.setBackground(round(cSurface2, dp(12)));
        toggle.setPadding(dp(3), dp(3), dp(3), dp(3));
        typeExpense = segment("Gasto");
        typeIncome = segment("Ingreso");
        typeExpense.setOnClickListener(v -> setType("expense"));
        typeIncome.setOnClickListener(v -> setType("income"));
        toggle.addView(typeExpense);
        toggle.addView(typeIncome);
        header.addView(toggle);
        sheet.addView(header);

        // Monto
        amountView = text("S/ 0", 46, cInk, true);
        amountView.setGravity(Gravity.CENTER);
        amountView.setPadding(0, dp(14), 0, dp(10));
        sheet.addView(amountView);

        // Cuentas
        sheet.addView(label("PAGADO CON"));
        accountRow = chipRow(sheet);
        // Categorías
        sheet.addView(label("CATEGORÍA"));
        categoryRow = chipRow(sheet);

        // Nota opcional (comercio o detalle)
        noteInput = new EditText(this);
        noteInput.setHint("Nota (opcional): comercio o detalle");
        noteInput.setHintTextColor(cMuted);
        noteInput.setTextColor(cInk);
        noteInput.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        noteInput.setSingleLine(true);
        noteInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        noteInput.setImeOptions(EditorInfo.IME_ACTION_DONE);
        noteInput.setPadding(dp(14), dp(12), dp(14), dp(12));
        GradientDrawable noteBg = round(cBg, dp(12));
        noteBg.setStroke(dp(1), cLine);
        noteInput.setBackground(noteBg);
        noteInput.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                hideKeyboard();
                return true;
            }
            return false;
        });
        LinearLayout.LayoutParams nlp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        nlp.bottomMargin = dp(4);
        sheet.addView(noteInput, nlp);

        // Teclado
        GridLayout keypad = new GridLayout(this);
        keypad.setColumnCount(3);
        String[] keys = {"1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"};
        for (String k : keys) {
            TextView key = text(k, 24, cInk, false);
            key.setGravity(Gravity.CENTER);
            key.setBackground(round(cBg, dp(28)));
            key.setOnClickListener(v -> {
                hideKeyboard();
                v.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);
                press(k);
            });
            if (k.equals("⌫")) {
                key.setOnLongClickListener(v -> {
                    digits.setLength(0);
                    refresh();
                    return true;
                });
            }
            GridLayout.LayoutParams lp = new GridLayout.LayoutParams(GridLayout.spec(GridLayout.UNDEFINED, 1f), GridLayout.spec(GridLayout.UNDEFINED, 1f));
            lp.width = 0;
            lp.height = dp(54);
            lp.setMargins(dp(4), dp(4), dp(4), dp(4));
            keypad.addView(key, lp);
        }
        LinearLayout.LayoutParams klp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        klp.topMargin = dp(10);
        sheet.addView(keypad, klp);

        saveButton = button("Guardar");
        saveButton.setOnClickListener(v -> save());
        LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(56));
        blp.topMargin = dp(12);
        sheet.addView(saveButton, blp);
        return root;
    }

    private void refresh() {
        if (amountView == null) return;
        String shown = digits.length() == 0 ? "0" : digits.toString();
        JSONObject acc = findById(snap.optJSONArray("accounts"), accountId);
        String cur = acc != null ? acc.optString("currency", "PEN") : "PEN";
        amountView.setText(("USD".equals(cur) ? "US$ " : "S/ ") + shown);
        amountView.setTextColor("income".equals(type) ? cPos : cInk);
        boolean expense = "expense".equals(type);
        styleSegment(typeExpense, expense);
        styleSegment(typeIncome, !expense);

        JSONArray cats = snap.optJSONArray(expense ? "categories" : "incomeCategories");
        if (categoryId != null && findById(cats, categoryId) == null) categoryId = null;
        JSONObject cat = findById(cats, categoryId);
        String label = cat != null ? cat.optString("name", "?") : (expense ? "G" : "I");
        emojiView.setText(label.isEmpty() ? "?" : label.substring(0, 1).toUpperCase());
        titleView.setText(cat != null ? cat.optString("name") : (expense ? "Nuevo gasto" : "Nuevo ingreso"));

        fillChips(accountRow, snap.optJSONArray("accounts"), accountId, id -> { accountId = id; refresh(); });
        fillChips(categoryRow, cats, categoryId, id -> { categoryId = id; refresh(); });

        boolean ready = amountCents() > 0 && categoryId != null && accountId != null;
        saveButton.setAlpha(ready ? 1f : 0.45f);
    }

    private interface OnPick { void pick(String id); }

    /** Opciones en cuadrícula (como en la app): hasta 4 por fila y máximo 8, la elegida siempre visible. */
    private void fillChips(GridLayout grid, JSONArray items, String selected, OnPick onPick) {
        grid.removeAllViews();
        if (items == null) return;
        List<JSONObject> list = new ArrayList<>();
        for (int i = 0; i < items.length(); i++) {
            JSONObject it = items.optJSONObject(i);
            if (it != null) list.add(it);
        }
        int max = 8;
        List<JSONObject> shown = new ArrayList<>(list.subList(0, Math.min(max, list.size())));
        if (selected != null && list.size() > max) {
            boolean present = false;
            for (JSONObject o : shown) if (selected.equals(o.optString("id"))) present = true;
            if (!present) for (JSONObject o : list) if (selected.equals(o.optString("id"))) { shown.set(max - 1, o); break; }
        }
        grid.setColumnCount(Math.max(1, Math.min(4, shown.size())));
        for (JSONObject it : shown) {
            String id = it.optString("id");
            boolean on = id.equals(selected);
            TextView tile = text(it.optString("name", ""), 13, on ? cBrand : cInk, on);
            tile.setGravity(Gravity.CENTER);
            tile.setMaxLines(1);
            tile.setEllipsize(android.text.TextUtils.TruncateAt.END);
            tile.setPadding(dp(6), dp(11), dp(6), dp(11));
            GradientDrawable d = round(on ? 0xFFE8F1EE : cSurface2, dp(12));
            if (on) d.setStroke(dp(1), cBrand);
            tile.setBackground(d);
            tile.setOnClickListener(v -> {
                hideKeyboard();
                onPick.pick(id);
            });
            GridLayout.LayoutParams lp = new GridLayout.LayoutParams(GridLayout.spec(GridLayout.UNDEFINED), GridLayout.spec(GridLayout.UNDEFINED, 1f));
            lp.width = 0;
            lp.setMargins(dp(3), dp(3), dp(3), dp(3));
            grid.addView(tile, lp);
        }
    }

    private void setType(String t) {
        if (t.equals(type)) return;
        type = t;
        categoryId = null;
        refresh();
    }

    private void press(String k) {
        String s = digits.toString();
        if (k.equals("⌫")) {
            if (s.length() > 0) digits.setLength(s.length() - 1);
        } else if (k.equals(".")) {
            if (!s.contains(".")) digits.append(s.isEmpty() ? "0." : ".");
        } else {
            int dot = s.indexOf('.');
            if (dot >= 0 && s.length() - dot > 2) return;
            if (dot < 0 && s.replaceFirst("^0", "").length() >= MAX_DIGITS) return;
            if (s.equals("0")) digits.setLength(0);
            digits.append(k);
        }
        refresh();
    }

    private long amountCents() {
        if (digits.length() == 0) return 0;
        try {
            return Math.round(Double.parseDouble(digits.toString()) * 100);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    // ───────────────────────── Guardar ─────────────────────────

    private void save() {
        long cents = amountCents();
        if (cents <= 0 || categoryId == null || accountId == null) {
            amountView.animate().translationX(dp(8)).setDuration(60).withEndAction(() ->
                    amountView.animate().translationX(0).setDuration(60).start()).start();
            return;
        }
        try {
            JSONObject item = new JSONObject();
            item.put("id", UUID.randomUUID().toString());
            item.put("type", type);
            item.put("amount", cents);
            item.put("accountId", accountId);
            item.put("categoryId", categoryId);
            item.put("date", new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date()));
            SimpleDateFormat iso = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            iso.setTimeZone(TimeZone.getTimeZone("UTC"));
            item.put("createdAt", iso.format(new Date()));
            String note = noteInput != null ? noteInput.getText().toString().trim() : "";
            if (!note.isEmpty()) item.put("note", note);
            WidgetStore.addPending(this, item);
            if (snap != null) {
                snap.put("lastAccountId", accountId);
                WidgetStore.saveSnapshot(this, snap.toString());
            }
        } catch (JSONException e) {
            Toast.makeText(this, "No se pudo guardar", Toast.LENGTH_SHORT).show();
            return;
        }
        JSONObject used = findById(snap.optJSONArray("accounts"), accountId);
        String base = snap.optString("currency", "PEN");
        String accCur = used != null ? used.optString("currency", base) : base;
        double rate = snap.optDouble("usdRate", 3.75);
        long baseCents = accCur.equals(base) ? cents : ("PEN".equals(base) ? Math.round(cents * rate) : Math.round(cents / rate));
        WidgetStore.adjustAvailable(this, "income".equals(type) ? baseCents : -baseCents);
        PlataWidgetProvider.updateAll(this);
        vibrate();
        JSONObject cat = findById(snap.optJSONArray("expense".equals(type) ? "categories" : "incomeCategories"), categoryId);
        JSONObject acc = findById(snap.optJSONArray("accounts"), accountId);
        String what = ("income".equals(type) ? "Ingreso " : "Gasto ") + WidgetStore.formatMoney(cents, acc != null ? acc.optString("currency", "PEN") : "PEN");
        Toast.makeText(this, "✓ " + what + (cat != null ? " · " + cat.optString("name") : ""), Toast.LENGTH_SHORT).show();
        finish();
    }

    private void vibrate() {
        Vibrator vib = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (vib == null) return;
        if (Build.VERSION.SDK_INT >= 26) vib.vibrate(VibrationEffect.createOneShot(25, VibrationEffect.DEFAULT_AMPLITUDE));
        else vib.vibrate(25);
    }

    // ───────────────────────── Helpers ─────────────────────────

    private void hideKeyboard() {
        if (noteInput == null || !noteInput.hasFocus()) return;
        InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        if (imm != null) imm.hideSoftInputFromWindow(noteInput.getWindowToken(), 0);
        noteInput.clearFocus();
    }

    private static JSONObject findById(JSONArray arr, String id) {
        if (arr == null || id == null) return null;
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o != null && id.equals(o.optString("id"))) return o;
        }
        return null;
    }

    private GridLayout chipRow(LinearLayout parent) {
        GridLayout grid = new GridLayout(this);
        grid.setColumnCount(4);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.bottomMargin = dp(10);
        parent.addView(grid, lp);
        return grid;
    }

    private TextView label(String s) {
        TextView t = text(s, 11, cMuted, true);
        t.setLetterSpacing(0.08f);
        t.setPadding(dp(2), 0, 0, dp(6));
        return t;
    }

    private TextView segment(String s) {
        TextView t = text(s, 13, cInk, true);
        t.setPadding(dp(12), dp(6), dp(12), dp(6));
        return t;
    }

    private void styleSegment(TextView t, boolean on) {
        t.setBackground(on ? round(cBg, dp(10)) : null);
        t.setTextColor(on ? cInk : cMuted);
    }

    private TextView button(String s) {
        TextView b = text(s, 16, cBrandInk, true);
        b.setGravity(Gravity.CENTER);
        GradientDrawable d = new GradientDrawable();
        d.setColor(cBrand);
        d.setCornerRadius(dp(12));
        b.setBackground(d);
        b.setPadding(0, dp(16), 0, dp(16));
        return b;
    }

    private TextView text(String s, float sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        if (bold) t.setTypeface(Typeface.create("sans-serif-medium", Typeface.BOLD));
        return t;
    }

    private GradientDrawable round(int color, int radius) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(radius);
        return d;
    }

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }
}
