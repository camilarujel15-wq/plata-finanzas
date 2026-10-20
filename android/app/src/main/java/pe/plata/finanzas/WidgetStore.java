package pe.plata.finanzas;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.util.Currency;
import java.util.Locale;

/**
 * Almacén compartido entre la app (WebView), el widget y la pantalla de registro rápido.
 *  - "snapshot": lo que el widget muestra (disponible, cuentas, categorías favoritas). Lo escribe la app.
 *  - "pending":  movimientos creados desde el widget que la app importa al abrirse.
 */
final class WidgetStore {
    private static final String PREFS = "plata_widget";
    private static final String KEY_SNAPSHOT = "snapshot";
    private static final String KEY_PENDING = "pending";

    private WidgetStore() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static JSONObject snapshot(Context ctx) {
        String raw = prefs(ctx).getString(KEY_SNAPSHOT, null);
        if (raw == null) return null;
        try {
            return new JSONObject(raw);
        } catch (JSONException e) {
            return null;
        }
    }

    static void saveSnapshot(Context ctx, String json) {
        prefs(ctx).edit().putString(KEY_SNAPSHOT, json).apply();
    }

    static synchronized void addPending(Context ctx, JSONObject item) {
        JSONArray list = pendingArray(ctx);
        list.put(item);
        prefs(ctx).edit().putString(KEY_PENDING, list.toString()).apply();
    }

    /** Devuelve y vacía la cola de forma atómica (evita importar dos veces). */
    static synchronized JSONArray drainPending(Context ctx) {
        JSONArray list = pendingArray(ctx);
        prefs(ctx).edit().remove(KEY_PENDING).commit();
        return list;
    }

    private static JSONArray pendingArray(Context ctx) {
        String raw = prefs(ctx).getString(KEY_PENDING, "[]");
        try {
            return new JSONArray(raw);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    /** Ajusta el disponible mostrado tras guardar desde el widget, hasta que la app recalcule. */
    static void adjustAvailable(Context ctx, long deltaCents) {
        JSONObject snap = snapshot(ctx);
        if (snap == null) return;
        try {
            snap.put("available", snap.optLong("available", 0) + deltaCents);
            saveSnapshot(ctx, snap.toString());
        } catch (JSONException ignored) {
        }
    }

    static String formatMoney(long cents, String currency) {
        NumberFormat f = NumberFormat.getCurrencyInstance(new Locale("es", "PE"));
        try {
            f.setCurrency(Currency.getInstance(currency));
        } catch (IllegalArgumentException ignored) {
        }
        String s = f.format(Math.abs(cents) / 100.0);
        if ("PEN".equals(currency)) s = s.replace("PEN", "S/").replace("S/ ", "S/ ");
        return cents < 0 ? "−" + s : s;
    }
}
