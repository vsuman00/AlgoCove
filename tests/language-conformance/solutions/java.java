import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

public class Main {
  public static void main(String[] args) throws Exception {
    BufferedReader reader = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
    long target = Long.parseLong(reader.readLine());
    String valuesLine = reader.readLine();
    String label = reader.readLine();
    String[] tokens = valuesLine == null || valuesLine.isBlank() ? new String[0] : valuesLine.split(",");
    long[] values = new long[tokens.length];
    for (int index = 0; index < tokens.length; index++) values[index] = Long.parseLong(tokens[index]);
    for (int left = 0; left < values.length; left++) {
      for (int right = left + 1; right < values.length; right++) {
        long sum = values[left] + values[right];
        boolean matches = sum == target;
        if (matches) {
          System.out.println(left + "," + right + "|" + label);
          return;
        }
      }
    }
    System.out.println("none|" + label);
  }
}
