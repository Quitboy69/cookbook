package at.youbywhatyoueat.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ReceiptOcrPlugin.class);
        registerPlugin(FoodAiPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
