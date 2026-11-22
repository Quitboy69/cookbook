package at.youbywhatyoueat.app;

import android.graphics.Point;
import android.graphics.Rect;
import android.net.Uri;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

/**
 * Kassenbon-Texterkennung direkt am Handy (Google ML Kit, offline).
 * Liefert jede erkannte Zeile mit Position, damit Artikel und Preise
 * in der App wieder zu Zeilen zusammengesetzt werden können.
 */
@CapacitorPlugin(name = "ReceiptOcr")
public class ReceiptOcrPlugin extends Plugin {

    private TextRecognizer recognizer;

    @Override
    public void load() {
        recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
    }

    @PluginMethod
    public void recognize(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("Kein Bild übergeben");
            return;
        }
        final InputImage image;
        try {
            image = InputImage.fromFilePath(getContext(), Uri.parse(path));
        } catch (Exception e) {
            call.reject("Bild konnte nicht geladen werden: " + e.getMessage());
            return;
        }
        recognizer.process(image)
            .addOnSuccessListener(text -> {
                JSObject res = new JSObject();
                res.put("text", text.getText());
                res.put("width", image.getWidth());
                res.put("height", image.getHeight());
                JSArray lines = new JSArray();
                for (Text.TextBlock block : text.getTextBlocks()) {
                    for (Text.Line line : block.getLines()) {
                        JSObject o = new JSObject();
                        o.put("text", line.getText());
                        Rect r = line.getBoundingBox();
                        if (r != null) {
                            o.put("x", r.left);
                            o.put("y", r.top);
                            o.put("w", r.width());
                            o.put("h", r.height());
                        }
                        Point[] cp = line.getCornerPoints();
                        if (cp != null && cp.length == 4) {
                            JSArray pts = new JSArray();
                            for (Point p : cp) {
                                pts.put(p.x);
                                pts.put(p.y);
                            }
                            o.put("pts", pts);
                        }
                        lines.put(o);
                    }
                }
                res.put("lines", lines);
                call.resolve(res);
            })
            .addOnFailureListener(e -> call.reject("Texterkennung fehlgeschlagen: " + e.getMessage()));
    }
}
