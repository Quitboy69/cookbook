package at.youbywhatyoueat.app;

import android.content.ContentResolver;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.graphics.Point;
import android.graphics.Rect;
import android.media.ExifInterface;
import android.net.Uri;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.common.model.LocalModel;
import com.google.mlkit.vision.barcode.BarcodeScanner;
import com.google.mlkit.vision.barcode.BarcodeScannerOptions;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.label.ImageLabel;
import com.google.mlkit.vision.label.ImageLabeler;
import com.google.mlkit.vision.label.ImageLabeling;
import com.google.mlkit.vision.label.custom.CustomImageLabelerOptions;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Lokale Essens-Erkennung – alles offline am Handy:
 *  - Barcode (EAN/UPC) im Foto
 *  - Text auf der Packung (Produktname, Nährwerttabelle)
 *  - Gerichte (Google AIY Food V1, ≈ 2.000 Klassen) auf mehreren Bildausschnitten
 *  - Obst, Gemüse & Alltagsdinge (MobileNetV3, ImageNet) auf mehreren Bildausschnitten
 */
@CapacitorPlugin(name = "FoodAi")
public class FoodAiPlugin extends Plugin {

    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private ImageLabeler dish, inet;
    private BarcodeScanner barcode;
    private TextRecognizer text;

    private synchronized ImageLabeler dish() {
        if (dish == null) {
            LocalModel m = new LocalModel.Builder().setAssetFilePath("food_v1.tflite").build();
            dish = ImageLabeling.getClient(new CustomImageLabelerOptions.Builder(m).setConfidenceThreshold(0.01f).setMaxResultCount(30).build());
        }
        return dish;
    }

    private synchronized ImageLabeler inet() {
        if (inet == null) {
            LocalModel m = new LocalModel.Builder().setAssetFilePath("inet_v3s.tflite").build();
            inet = ImageLabeling.getClient(new CustomImageLabelerOptions.Builder(m).setConfidenceThreshold(0.02f).setMaxResultCount(15).build());
        }
        return inet;
    }

    private synchronized BarcodeScanner barcode() {
        if (barcode == null) {
            BarcodeScannerOptions o = new BarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8, Barcode.FORMAT_UPC_A, Barcode.FORMAT_UPC_E)
                .build();
            barcode = BarcodeScanning.getClient(o);
        }
        return barcode;
    }

    private synchronized TextRecognizer text() {
        if (text == null) text = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        return text;
    }

    /** Bild laden (verkleinert) und nach EXIF drehen */
    private Bitmap load(Uri uri, int maxSide) throws Exception {
        ContentResolver cr = getContext().getContentResolver();
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try (InputStream in = cr.openInputStream(uri)) { BitmapFactory.decodeStream(in, null, bounds); }
        int sample = 1;
        while (Math.max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxSide) sample *= 2;
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inSampleSize = sample;
        Bitmap b;
        try (InputStream in = cr.openInputStream(uri)) { b = BitmapFactory.decodeStream(in, null, o); }
        if (b == null) throw new Exception("Bild leer");
        int rot = 0;
        try (InputStream in = cr.openInputStream(uri)) {
            int ori = new ExifInterface(in).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
            if (ori == ExifInterface.ORIENTATION_ROTATE_90) rot = 90;
            else if (ori == ExifInterface.ORIENTATION_ROTATE_180) rot = 180;
            else if (ori == ExifInterface.ORIENTATION_ROTATE_270) rot = 270;
        } catch (Exception ignored) { /* kein EXIF */ }
        if (rot != 0) {
            Matrix mx = new Matrix();
            mx.postRotate(rot);
            b = Bitmap.createBitmap(b, 0, 0, b.getWidth(), b.getHeight(), mx, true);
        }
        return b;
    }

    private Bitmap crop(Bitmap b, double frac) {
        int w = (int) Math.round(b.getWidth() * frac), h = (int) Math.round(b.getHeight() * frac);
        int x = (b.getWidth() - w) / 2, y = (b.getHeight() - h) / 2;
        return Bitmap.createBitmap(b, x, y, w, h);
    }

    /** Mehrere Ausschnitte klassifizieren und die Wahrscheinlichkeiten mitteln */
    private JSArray vote(ImageLabeler labeler, List<Bitmap> views, int keep) throws Exception {
        Map<Integer, double[]> acc = new HashMap<>();   // index → [Summe, Anzahl, Text als hash]
        Map<Integer, String> names = new HashMap<>();
        for (Bitmap v : views) {
            List<ImageLabel> ls = Tasks.await(labeler.process(InputImage.fromBitmap(v, 0)));
            for (ImageLabel l : ls) {
                double[] a = acc.get(l.getIndex());
                if (a == null) { a = new double[]{0, 0}; acc.put(l.getIndex(), a); names.put(l.getIndex(), l.getText()); }
                a[0] += l.getConfidence();
                a[1] += 1;
            }
        }
        List<Map.Entry<Integer, double[]>> list = new ArrayList<>(acc.entrySet());
        final int n = views.size();
        list.sort((x, y) -> Double.compare(y.getValue()[0], x.getValue()[0]));
        JSArray arr = new JSArray();
        for (int i = 0; i < Math.min(keep, list.size()); i++) {
            Map.Entry<Integer, double[]> e = list.get(i);
            JSObject o = new JSObject();
            o.put("index", e.getKey());
            o.put("text", names.get(e.getKey()));
            o.put("conf", e.getValue()[0] / n);          // Durchschnitt über alle Ausschnitte
            o.put("votes", e.getValue()[1]);
            arr.put(o);
        }
        return arr;
    }

    @PluginMethod
    public void analyze(PluginCall call) {
        final String path = call.getString("path");
        if (path == null || path.isEmpty()) { call.reject("Kein Bild übergeben"); return; }
        io.execute(() -> {
            try {
                Bitmap full = load(Uri.parse(path), 1800);
                JSObject res = new JSObject();
                res.put("width", full.getWidth());
                res.put("height", full.getHeight());

                // 1) Barcode
                JSArray codes = new JSArray();
                try {
                    List<Barcode> bs = Tasks.await(barcode().process(InputImage.fromBitmap(full, 0)));
                    for (Barcode b : bs) {
                        if (b.getRawValue() == null) continue;
                        JSObject o = new JSObject();
                        o.put("value", b.getRawValue());
                        o.put("format", b.getFormat());
                        codes.put(o);
                    }
                } catch (Exception ignored) { /* kein Barcode */ }
                res.put("barcodes", codes);

                // 2) Text auf der Packung
                JSArray lines = new JSArray();
                StringBuilder all = new StringBuilder();
                try {
                    Text t = Tasks.await(text().process(InputImage.fromBitmap(full, 0)));
                    for (Text.TextBlock block : t.getTextBlocks()) {
                        for (Text.Line line : block.getLines()) {
                            JSObject o = new JSObject();
                            o.put("text", line.getText());
                            Rect r = line.getBoundingBox();
                            if (r != null) { o.put("x", r.left); o.put("y", r.top); o.put("w", r.width()); o.put("h", r.height()); }
                            Point[] cp = line.getCornerPoints();
                            if (cp != null && cp.length == 4) {
                                JSArray pts = new JSArray();
                                for (Point p : cp) { pts.put(p.x); pts.put(p.y); }
                                o.put("pts", pts);
                            }
                            lines.put(o);
                            all.append(line.getText()).append('\n');
                        }
                    }
                } catch (Exception ignored) { /* kein Text */ }
                res.put("lines", lines);
                res.put("text", all.toString());

                // 3) KI-Erkennung auf mehreren Ausschnitten (Voll, Mitte 75 %, Mitte 55 %)
                List<Bitmap> views = new ArrayList<>();
                views.add(full);
                views.add(crop(full, 0.75));
                views.add(crop(full, 0.55));
                res.put("labels", vote(dish(), views, 10));
                try { res.put("inet", vote(inet(), views.subList(0, 2), 6)); } catch (Exception e) { res.put("inet", new JSArray()); }
                call.resolve(res);
            } catch (Exception e) {
                call.reject("Erkennung fehlgeschlagen: " + e.getMessage());
            }
        });
    }
}
