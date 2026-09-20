package com.medicheck.server.domain.hospital.client;

import com.medicheck.server.global.config.HiraDiagApiProperties;
import com.medicheck.server.global.config.RestTemplateConfig;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.hamcrest.Matchers.startsWith;

class HiraClinicTop5ClientTest {

    @ParameterizedTest
    @ValueSource(strings = {"application/xml", "text/xml", "application/octet-stream",
            "application/xml;charset=UTF-8", "application/xml;charset=EUC-KR"})
    void preservesKoreanDiseaseNamesAcrossHttpDecoding(String contentType) {
        var restTemplate = new RestTemplateConfig().hiraRestTemplate();
        var server = MockRestServiceServer.bindTo(restTemplate).build();
        var properties = new HiraDiagApiProperties();
        properties.setServiceKey("test-key");
        var client = new HiraClinicTop5Client(properties, restTemplate);
        String xml = """
                <?xml version="1.0"?>
                <response><header><resultCode>00</resultCode></header><body><items><item>
                  <ykiho>test-hospital</ykiho>
                  <mfrnIntrsIlnsNm1>급성 기관지염</mfrnIntrsIlnsNm1>
                  <mfrnIntrsIlnsNm2>본태성 고혈압</mfrnIntrsIlnsNm2>
                  <mfrnIntrsIlnsNm3>B형간염</mfrnIntrsIlnsNm3>
                  <mfrnIntrsIlnsNm4>당뇨병</mfrnIntrsIlnsNm4>
                  <mfrnIntrsIlnsNm5>알레르기 비염</mfrnIntrsIlnsNm5>
                </item></items></body></response>
                """;
        MediaType mediaType = MediaType.parseMediaType(contentType);
        Charset charset = mediaType.getCharset() != null ? mediaType.getCharset() : StandardCharsets.UTF_8;
        server.expect(requestTo(startsWith(properties.getBaseUrl() + "/getClinicTop5List1?")))
                .andRespond(withSuccess(xml.getBytes(charset), mediaType));

        var item = client.getClinicTop5List1("test-hospital", 1, 10);

        assertThat(item).isNotNull();
        assertThat(item.getMfrnIntrsIlnsNm1()).isEqualTo("급성 기관지염");
        assertThat(item.getMfrnIntrsIlnsNm2()).isEqualTo("본태성 고혈압");
        assertThat(item.getMfrnIntrsIlnsNm3()).isEqualTo("B형간염");
        assertThat(item.getMfrnIntrsIlnsNm4()).isEqualTo("당뇨병");
        assertThat(item.getMfrnIntrsIlnsNm5()).isEqualTo("알레르기 비염");
        server.verify();
    }
}
