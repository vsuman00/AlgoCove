#include <iostream>
#include <sstream>
#include <string>
#include <vector>

int main() {
  std::string target_line;
  std::string values_line;
  std::string label;
  std::getline(std::cin, target_line);
  std::getline(std::cin, values_line);
  std::getline(std::cin, label);
  const long long target = std::stoll(target_line);
  std::vector<long long> values;
  std::stringstream values_stream(values_line);
  std::string token;
  while (std::getline(values_stream, token, ',')) {
    if (!token.empty()) values.push_back(std::stoll(token));
  }
  for (std::size_t left = 0; left < values.size(); left += 1) {
    for (std::size_t right = left + 1; right < values.size(); right += 1) {
      const long long sum = values[left] + values[right];
      const bool matches = sum == target;
      if (matches) {
        std::cout << left << "," << right << "|" << label << "\n";
        return 0;
      }
    }
  }
  std::cout << "none|" << label << "\n";
}
