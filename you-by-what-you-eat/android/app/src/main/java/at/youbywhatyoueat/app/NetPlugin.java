package at.youbywhatyoueat.app;

import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Kleine Netzwerk-Brücke nur für Strava (die Strava-Schnittstelle erlaubt keine Aufrufe aus dem WebView).
 *  - request: HTTPS-Aufruf an www.strava.com (Anmeldung, Token erneuern, Aktivitäten lesen)
 *  - open:    Strava-Seite im Browser bzw. in der Strava-App öffnen (Freigabe erteilen)
 * Andere Adressen werden abgelehnt.
 */
@CapacitorPlugin(name = "Net")
public class NetPlugin extends Plugin {

    private static final String HOST = "www.strava.com";
    private final ExecutorService io = Executors.newFixedThreadPool(2);

    private static boolean allowed(String url) {
        if (url == null) return false;
        Uri u = Uri.parse(url);
        return "https".equals(u.getScheme()) && HOST.equals(u.getHost());
    }

    @PluginMethod
    public void request(PluginCall call) {
        final String url = call.getString("url");
        if (!allowed(url)) { call.reject("Nur www.strava.com ist erlaubt"); return; }
        final String method = call.getString("method", "GET");
        final JSObject headers = call.getObject("headers", new JSObject());
        final String body = call.getString("body");
        io.execute(() -> {
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL(url).openConnection();
                c.setRequestMethod(method);
                c.setConnectTimeout(12000);
                c.setReadTimeout(25000);
                c.setInstanceFollowRedirects(false);
                Iterator<String> it = headers.keys();
                while (it.hasNext()) { String k = it.next(); c.setRequestProperty(k, headers.getString(k)); }
                if (body != null) {
                    c.setDoOutput(true);
                    byte[] data = body.getBytes(StandardCharsets.UTF_8);
                    c.setFixedLengthStreamingMode(data.length);
                    try (OutputStream os = c.getOutputStream()) { os.write(data); }
                }
                int code = c.getResponseCode();
                InputStream is = code >= 400 ? c.getErrorStream() : c.getInputStream();
                String text = "";
                if (is != null) {
                    ByteArrayOutputStream bo = new ByteArrayOutputStream();
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = is.read(buf)) > 0 && bo.size() < 8_000_000) bo.write(buf, 0, n);
                    is.close();
                    text = bo.toString("UTF-8");
                }
                JSObject res = new JSObject();
                res.put("status", code);
                res.put("body", text);
                call.resolve(res);
            } catch (Exception e) {
                call.reject("Netzwerkfehler: " + e.getMessage());
            } finally {
                if (c != null) c.disconnect();
            }
        });
    }

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (!allowed(url)) { call.reject("Nur www.strava.com ist erlaubt"); return; }
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Konnte die Seite nicht öffnen: " + e.getMessage());
        }
    }
}
