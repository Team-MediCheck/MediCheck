package com.medicheck.server.domain.hospital.service;

import com.medicheck.server.domain.hospital.client.dto.HiraHospItem;
import com.medicheck.server.domain.hospital.entity.Hospital;
import com.medicheck.server.domain.hospital.repository.HospitalRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class HospitalPersistenceServiceTest {

    @Mock
    private HospitalRepository hospitalRepository;

    @InjectMocks
    private HospitalPersistenceService hospitalPersistenceService;

    @Test
    @DisplayName("updateExistingHospitals - 기존 ykiho에 해당하는 병원만 HIRA 데이터로 갱신한다")
    void updateExistingHospitals_updatesOnlyExistingByYkiho() {
        String ykiho = "YKIHO001";
        HiraHospItem item = new HiraHospItem();
        item.setYkiho(ykiho);
        item.setYadmNm("갱신된병원명");
        item.setAddr("갱신된주소");
        item.setTelno("02-9999-8888");
        item.setClCdNm("병원");
        item.setXPos("127.0");
        item.setYPos("37.5");
        item.setEstbDd("20100101");
        item.setDrTotCnt(10);

        Hospital existing = Hospital.builder()
                .name("기존병원명")
                .address("기존주소")
                .publicCode(ykiho)
                .phone("02-1111-2222")
                .department("내과")
                .latitude(BigDecimal.valueOf(37.5))
                .longitude(BigDecimal.valueOf(127.0))
                .build();

        given(hospitalRepository.findAllByPublicCodeIn(List.of(ykiho))).willReturn(List.of(existing));

        int updated = hospitalPersistenceService.updateExistingHospitals(List.of(item));

        assertThat(updated).isEqualTo(1);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Iterable<Hospital>> captor = ArgumentCaptor.forClass(Iterable.class);
        verify(hospitalRepository).saveAll(captor.capture());
        Hospital saved = captor.getValue().iterator().next();
        assertThat(saved.getName()).isEqualTo("갱신된병원명");
        assertThat(saved.getAddress()).isEqualTo("갱신된주소");
        assertThat(saved.getPhone()).isEqualTo("02-9999-8888");
        assertThat(saved.getDoctorTotalCount()).isEqualTo(10);
    }

    @Test
    @DisplayName("updateExistingHospitals - DB에 없는 ykiho는 건너뛴다")
    void updateExistingHospitals_skipsWhenNotFound() {
        HiraHospItem item = new HiraHospItem();
        item.setYkiho("NOEXIST");
        item.setYadmNm("병원명");
        given(hospitalRepository.findAllByPublicCodeIn(List.of("NOEXIST"))).willReturn(List.of());

        int updated = hospitalPersistenceService.updateExistingHospitals(List.of(item));

        assertThat(updated).isZero();
        verify(hospitalRepository).findAllByPublicCodeIn(List.of("NOEXIST"));
        verify(hospitalRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("updateExistingHospitals - 빈 리스트는 0을 반환한다")
    void updateExistingHospitals_returns0ForEmptyList() {
        int updated = hospitalPersistenceService.updateExistingHospitals(List.of());
        assertThat(updated).isZero();
        verify(hospitalRepository, never()).findAllByPublicCodeIn(any());
    }

    @Test
    @DisplayName("saveNewHospitals - 좌표가 없으면 신규 저장하지 않는다(DB location NOT NULL)")
    void saveNewHospitals_skipsWhenNoCoordinates() {
        HiraHospItem item = new HiraHospItem();
        item.setYkiho("NO_COORD");
        item.setYadmNm("무좌표병원");
        item.setAddr("주소만있음");

        given(hospitalRepository.findAllByPublicCodeIn(List.of("NO_COORD"))).willReturn(List.of());

        int saved = hospitalPersistenceService.saveNewHospitals(List.of(item));

        assertThat(saved).isZero();
        verify(hospitalRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("saveNewHospitals - 위경도가 있으면 saveAll 한다")
    void saveNewHospitals_persistsWhenCoordinatesPresent() {
        HiraHospItem item = new HiraHospItem();
        item.setYkiho("HAS_COORD");
        item.setYadmNm("좌표병원");
        item.setXPos("128.5");
        item.setYPos("35.9");

        given(hospitalRepository.findAllByPublicCodeIn(List.of("HAS_COORD"))).willReturn(List.of());

        int saved = hospitalPersistenceService.saveNewHospitals(List.of(item));

        assertThat(saved).isEqualTo(1);
        verify(hospitalRepository).saveAll(any());
    }
}
