package at.youbywhatyoueat.app;

import android.net.Uri;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.common.model.LocalModel;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.label.ImageLabel;
import com.google.mlkit.vision.label.ImageLabeler;
import com.google.mlkit.vision.label.ImageLabeling;
import com.google.mlkit.vision.label.custom.CustomImageLabelerOptions;

/**
 * Lokale Essens-Erkennung: Google AIY Food V1 (2024 Gerichte) über ML Kit.
 * Läuft komplett am Handy, ohne Internet.
 */
@CapacitorPlugin(name = "FoodAi")
public class FoodAiPlugin extends Plugin {

    private ImageLabeler labeler;

    private synchronized ImageLabeler labeler() {
        if (labeler == null) {
            LocalModel model = new LocalModel.Builder().setAssetFilePath("food_v1.tflite").build();
            CustomImageLabelerOptions options = new CustomImageLabelerOptions.Builder(model)
                .setConfidenceThreshold(0.01f)
                .setMaxResultCount(8)
                .build();
            labeler = ImageLabeling.getClient(options);
        }
        return labeler;
    }

    @PluginMethod
    public void classify(PluginCall call) {
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
        try {
            labeler().process(image)
                .addOnSuccessListener(labels -> {
                    JSArray arr = new JSArray();
                    for (ImageLabel l : labels) {
                        JSObject o = new JSObject();
                        o.put("index", l.getIndex());
                        o.put("text", l.getText());
                        o.put("conf", (double) l.getConfidence());
                        arr.put(o);
                    }
                    JSObject res = new JSObject();
                    res.put("labels", arr);
                    call.resolve(res);
                })
                .addOnFailureListener(e -> call.reject("Erkennung fehlgeschlagen: " + e.getMessage()));
        } catch (Exception e) {
            call.reject("Erkennung nicht verfügbar: " + e.getMessage());
        }
    }
}
