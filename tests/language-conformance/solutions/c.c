#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(void) {
  char target_line[128];
  char values_line[1024];
  char label[256];
  if (fgets(target_line, sizeof(target_line), stdin) == NULL ||
      fgets(values_line, sizeof(values_line), stdin) == NULL ||
      fgets(label, sizeof(label), stdin) == NULL) {
    return 2;
  }
  target_line[strcspn(target_line, "\r\n")] = '\0';
  values_line[strcspn(values_line, "\r\n")] = '\0';
  label[strcspn(label, "\r\n")] = '\0';
  const long long target = strtoll(target_line, NULL, 10);
  long long values[64];
  size_t count = 0;
  char *token = strtok(values_line, ",");
  while (token != NULL && count < 64) {
    values[count] = strtoll(token, NULL, 10);
    count += 1;
    token = strtok(NULL, ",");
  }
  for (size_t left = 0; left < count; left += 1) {
    for (size_t right = left + 1; right < count; right += 1) {
      const long long sum = values[left] + values[right];
      const int matches = sum == target;
      if (matches) {
        printf("%zu,%zu|%s\n", left, right, label);
        return 0;
      }
    }
  }
  printf("none|%s\n", label);
  return 0;
}
