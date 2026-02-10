package com.medicheck.server.client.hira.dto;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonNode;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * 공공데이터포털 API 응답에서 item 이 단일 객체 또는 배열인 경우 모두 List로 역직렬화.
 * ObjectMapper 는 JsonParser 가 가진 codec 을 그대로 사용해 전역 Jackson 설정을 따르게 한다.
 */
public class SingleOrArrayDeserializer extends JsonDeserializer<List<HiraHospItem>> {

    @Override
    public List<HiraHospItem> deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
        var codec = p.getCodec();
        JsonNode node = codec.readTree(p);
        if (node == null || node.isNull()) return List.of();
        List<HiraHospItem> list = new ArrayList<>();
        if (node.isArray()) {
            for (JsonNode elem : node) {
                list.add(codec.treeToValue(elem, HiraHospItem.class));
            }
        } else {
            list.add(codec.treeToValue(node, HiraHospItem.class));
        }
        return list;
    }
}
