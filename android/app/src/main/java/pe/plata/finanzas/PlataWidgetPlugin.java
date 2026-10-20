package pe.plata.finanzas;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;

/** Puente JS ↔ Android para el widget. */
@CapacitorPlugin(name = "PlataWidget")
public class PlataWidgetPlugin extends Plugin {

    @PluginMethod
    public void setSnapshot(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("json requerido");
            return;
        }
        Context ctx = getContext();
        WidgetStore.saveSnapshot(ctx, json);
        PlataWidgetProvider.updateAll(ctx);
        call.resolve();
    }

    @PluginMethod
    public void drainPending(PluginCall call) {
        JSONArray items = WidgetStore.drainPending(getContext());
        JSObject ret = new JSObject();
        try {
            ret.put("items", new JSArray(items.toString()));
        } catch (JSONException e) {
            ret.put("items", new JSArray());
        }
        call.resolve(ret);
    }

    /** Muestra el diálogo del sistema "Agregar widget a la pantalla de inicio" (Android 8+). */
    @PluginMethod
    public void requestPin(PluginCall call) {
        Context ctx = getContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(ctx);
        boolean supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager.isRequestPinAppWidgetSupported();
        if (supported) {
            manager.requestPinAppWidget(new ComponentName(ctx, PlataWidgetProvider.class), null, null);
        }
        JSObject ret = new JSObject();
        ret.put("supported", supported);
        ret.put("installed", manager.getAppWidgetIds(new ComponentName(ctx, PlataWidgetProvider.class)).length > 0);
        call.resolve(ret);
    }
}
