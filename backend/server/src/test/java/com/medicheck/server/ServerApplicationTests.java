package com.medicheck.server;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

@TestPropertySource(properties = "admin.sync-key=test-sync-key")
@ActiveProfiles("test")
@SpringBootTest
class ServerApplicationTests {

	@Test
	void contextLoads() {
	}

}
