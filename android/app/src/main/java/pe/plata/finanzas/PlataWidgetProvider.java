package pe.plata.finanzas;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/** Widget de pantalla de inicio: disponible real + categorías favoritas para registrar en un toque. */
public class PlataWidgetProvider extends AppWidgetProvider {

    private static final int[] TILE_IDS = {R.id.tile0, R.id.tile1, R.id.tile2, R.id.tile3};
    private static final int[] EMOJI_IDS = {R.id.tile0_emoji, R.id.tile1_emoji, R.id.tile2_emoji, R.id.tile3_emoji};
    private static final int[] LABEL_IDS = {R.id.tile0_label, R.id.tile1_label, R.id.tile2_label, R.id.tile3_label};

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, build(context));
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, PlataWidgetProvider.class));
        if (ids.length == 0) return;
        RemoteViews views = build(context);
        for (int id : ids) manager.updateAppWidget(id, views);
    }

    private static RemoteViews build(Context ctx) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_plata);
        JSONObject snap = WidgetStore.snapshot(ctx);

        PendingIntent openApp = PendingIntent.getActivity(
                ctx, 1, new Intent(ctx, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.widget_header, openApp);

        if (snap == null) {
            v.setTextViewText(R.id.widget_amount, "Abre Plata");
            v.setTextViewText(R.id.widget_label, "Configura tu cuenta");
            for (int id : TILE_IDS) v.setViewVisibility(id, View.GONE);
            v.setOnClickPendingIntent(R.id.widget_add, openApp);
            v.setViewVisibility(R.id.tile_voice, View.GONE);
            return v;
        }

        String currency = snap.optString("currency", "PEN");
        boolean hide = snap.optBoolean("hide", false);
        v.setTextViewText(R.id.widget_label, "Disponible real");
        v.setTextViewText(R.id.widget_amount, hide ? "S/ •••••" : WidgetStore.formatMoney(snap.optLong("available", 0), currency));

        v.setOnClickPendingIntent(R.id.widget_add, quickEntry(ctx, 10, null));

        JSONArray favs = snap.optJSONArray("favorites");
        for (int i = 0; i < TILE_IDS.length; i++) {
            JSONObject c = favs != null ? favs.optJSONObject(i) : null;
            if (c == null) {
                v.setViewVisibility(TILE_IDS[i], View.GONE);
                continue;
            }
            v.setViewVisibility(TILE_IDS[i], View.VISIBLE);
            v.setTextViewText(EMOJI_IDS[i], c.optString("icon", "🏷️"));
            v.setTextViewText(LABEL_IDS[i], c.optString("name", ""));
            v.setOnClickPendingIntent(TILE_IDS[i], quickEntry(ctx, 20 + i, c.optString("id")));
        }

        Intent voice = new Intent(Intent.ACTION_VIEW, Uri.parse("plata://voice"), ctx, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        v.setViewVisibility(R.id.tile_voice, View.VISIBLE);
        v.setOnClickPendingIntent(R.id.tile_voice,
                PendingIntent.getActivity(ctx, 30, voice, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return v;
    }

    private static PendingIntent quickEntry(Context ctx, int requestCode, String categoryId) {
        Intent i = new Intent(ctx, QuickEntryActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK | Intent.FLAG_ACTIVITY_NO_ANIMATION);
        if (categoryId != null) i.putExtra(QuickEntryActivity.EXTRA_CATEGORY, categoryId);
        return PendingIntent.getActivity(ctx, requestCode, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
